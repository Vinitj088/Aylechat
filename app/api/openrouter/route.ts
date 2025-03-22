import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Maximum allowed for Vercel Hobby plan

// OpenRouter endpoint
const API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * IMPORTANT: You need to add OPENROUTER_API_KEY to your environment variables
 * 
 * 1. Get an API key from https://openrouter.ai/
 * 2. Add it to your .env.local file as OPENROUTER_API_KEY=your_api_key
 * 3. If deploying to Vercel, also add it to your Vercel environment variables
 */

// Model mapping - this maps our internal model IDs to OpenRouter model IDs
const MODEL_MAPPING: Record<string, string> = {
  'gemma3-27b': 'google/gemma-3-27b-it:free', // Gemma 3 27B model ID on OpenRouter with free variant
  'mistralai/mistral-small-3.1-24b-instruct:free': 'mistralai/mistral-small-3.1-24b-instruct:free',
};

// Function to handle streaming responses from OpenRouter
async function processStream(
  response: Response,
  controller: ReadableStreamDefaultController
) {
  const reader = response.body?.getReader();
  const encoder = new TextEncoder();
  
  if (!reader) {
    throw new Error('Failed to get response reader');
  }
  
  const decoder = new TextDecoder();
  let buffer = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      // Decode the chunk and add it to our buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process each line
      let lineEnd = buffer.indexOf('\n');
      while (lineEnd !== -1) {
        const line = buffer.substring(0, lineEnd).trim();
        buffer = buffer.substring(lineEnd + 1);
        
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            // Remove 'data: ' prefix and parse JSON
            const data = JSON.parse(line.substring(6));
            
            // Format in a way compatible with client-side parsing
            if (data.choices?.[0]?.delta?.content) {
              const message = {
                choices: [
                  {
                    delta: {
                      content: data.choices[0].delta.content
                    }
                  }
                ]
              };
              
              controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));
            }
          } catch (e) {
            console.error('Error parsing line:', e);
          }
        }
        
        lineEnd = buffer.indexOf('\n');
      }
    }
    
    controller.close();
  } catch (error) {
    controller.error(error);
  }
}

export async function POST(req: NextRequest) {
  let model: string = '';
  
  try {
    // Parse request body
    const body = await req.json();
    const { query, messages } = body;
    model = body.model || '';
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
    }
    if (!model) {
      return new Response(JSON.stringify({ error: 'model is required' }), { status: 400 });
    }

    // Log some information about the request
    console.log(`Processing OpenRouter request with model: ${model}`);
    console.log(`Message count: ${messages?.length || 0}`);
    
    // Get API key from environment variable
    const API_KEY = process.env.OPENROUTER_API_KEY;
    
    if (!API_KEY) {
      throw new Error('OPENROUTER_API_KEY environment variable not set');
    }
    
    // Map the model name to OpenRouter's model name
    const actualModelName = MODEL_MAPPING[model] || model;
    
    // Format messages for OpenAI-compatible format
    const formattedMessages = messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Add the current query if not already included
    if (formattedMessages.length === 0 || 
        formattedMessages[formattedMessages.length - 1].role !== 'user') {
      formattedMessages.push({
        role: 'user',
        content: query
      });
    }
    
    // Parameters for OpenRouter API (OpenAI-compatible)
    const params = {
      messages: formattedMessages,
      model: actualModelName,
      temperature: 0.7,
      stream: true,
      top_p: 0.95,
      max_tokens: 4000
    };
    
    // Call the OpenRouter API for streaming
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://exachat-app.vercel.app', // Replace with your actual domain
        'X-Title': 'ExaChat App' // Your app name
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
    }
    
    // Create a streaming response
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            await processStream(response, controller);
          } catch (error: any) {
            console.error('Error in OpenRouter stream processing:', error);
            
            // Send an error message to the client
            const errorResponse = {
              choices: [
                {
                  delta: {
                    content: `Error: ${error.message || 'Failed to process stream'}`
                  }
                }
              ]
            };
            controller.enqueue(new TextEncoder().encode(JSON.stringify(errorResponse) + '\n'));
            controller.close();
          }
        }
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      }
    );
  } catch (error: any) {
    console.error('OpenRouter API error:', error);
    
    const errorResponse = {
      error: `Failed to perform OpenRouter request | ${error.message}`,
      message: "I apologize, but I couldn't complete your request. Please try again."
    };
    
    return new Response(
      JSON.stringify(errorResponse), 
      { status: 500 }
    );
  }
} 