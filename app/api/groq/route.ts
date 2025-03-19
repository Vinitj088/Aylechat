import { NextRequest } from 'next/server';
import { Message } from '@/app/types';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Maximum allowed for Vercel Hobby plan

export async function POST(req: NextRequest) {
  try {
    // Parse request body first
    const body = await req.json();
    const { query, model, messages } = body;
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
    }
    if (!model) {
      return new Response(JSON.stringify({ error: 'model is required' }), { status: 400 });
    }

    // Skip authentication checks - allow all requests
    // Log some information about the request
    console.log(`Processing Groq request with model: ${model}`);
    console.log(`Message count: ${messages?.length || 0}`);
    
    const API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
    const API_KEY = process.env.GROQ_API_KEY;
    
    if (!API_KEY) {
      throw new Error('GROQ_API_KEY environment variable not set');
    }
    
    // Add role to messages 
    const formattedMessages = [{ role: 'user', content: query }];
    
    // Parameters for GROQ API
    const params = {
      messages: formattedMessages,
      model: model,
      temperature: 0.5,
      max_tokens: 4000,
      stream: true,
      top_p: 1,
    };
    
    // Call the GROQ API for streaming
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Groq API error: ${error.error?.message || response.statusText}`);
    }
    
    // Return a streaming response
    const encoder = new TextEncoder();
    const reader = response.body?.getReader();
    
    if (!reader) {
      throw new Error('Failed to get response reader');
    }
    
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            const decoder = new TextDecoder();
            
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                controller.close();
                break;
              }
              
              const text = decoder.decode(value);
              const lines = text.split('\n').filter(line => line.trim() !== '');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  
                  // The "data: [DONE]" line indicates the end of the stream
                  if (data === '[DONE]') {
                    continue;
                  }
                  
                  try {
                    const json = JSON.parse(data);
                    const delta = json.choices[0]?.delta;
                    
                    if (delta && delta.content) {
                      const message = {
                        choices: [
                          {
                            delta: {
                              content: delta.content
                            }
                          }
                        ]
                      };
                      
                      controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));
                    }
                  } catch (error) {
                    console.error('Error parsing JSON:', error);
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error in stream processing:', error);
            controller.error(error);
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
    console.error('Groq API error:', error);
    return new Response(
      JSON.stringify({ 
        error: `Failed to perform Groq request | ${error.message}`,
        message: "I apologize, but I couldn't complete your request. Please try again."
      }), 
      { status: 500 }
    );
  }
} 