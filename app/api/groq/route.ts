import { NextRequest } from 'next/server';
import { Message } from '@/app/types';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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
    
    // Groq API endpoint
    const groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
    
    // Get API key from environment variable
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY is not configured' }), { status: 500 });
    }

    // Format messages for Groq API in the correct format
    const formattedMessages = messages && messages.length > 0 
      ? messages.map((msg: Message) => ({
          role: msg.role,
          content: msg.content
        }))
      // If no messages history is provided, just use the query
      : [{ role: 'user', content: query }];

    // Add latest user query if not already included in messages
    if (messages?.length > 0 && query) {
      const lastMessage = formattedMessages[formattedMessages.length - 1];
      if (lastMessage.role !== 'user' || lastMessage.content !== query) {
        formattedMessages.push({ role: 'user', content: query });
      }
    }

    // Add timeout promise to avoid hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Groq API request timed out')), 45000); // 45 seconds timeout
    });

    // Prepare the request to Groq API with a timeout
    const fetchPromise = fetch(groqEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: formattedMessages,
        stream: true
      })
    });
    
    // Use Promise.race to implement timeout
    const groqResponse = await Promise.race([fetchPromise, timeoutPromise]) as Response;

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json();
      console.error('Groq API error response:', errorData);
      
      // Handle rate limit errors specifically
      if (groqResponse.status === 429) {
        return new Response(JSON.stringify({ 
          error: {
            message: errorData.error?.message || 'Rate limit reached',
            type: errorData.error?.type || 'tokens',
            code: errorData.error?.code || 'rate_limit_exceeded'
          }
        }), { status: 429 });
      }
      
      return new Response(JSON.stringify({ error: `Groq API error: ${errorData.error?.message || 'Unknown error'}` }), { 
        status: groqResponse.status 
      });
    }

    // Create a TransformStream to process the SSE data from Groq
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Buffer to accumulate partial chunks
    let buffer = '';
    let contentAccumulator = ''; // Track total content for debugging
    
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        try {
          const text = decoder.decode(chunk);
          // Add the new text to our buffer
          buffer += text;
          
          // Process complete lines
          const lines = buffer.split('\n');
          // Keep the last line in the buffer if it's incomplete
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6); // Remove 'data: ' prefix
              
              if (data === '[DONE]') {
                // End of stream marker from Groq
                continue;
              }
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.choices && parsed.choices[0]?.delta?.content) {
                  // Keep track of content for debugging
                  contentAccumulator += parsed.choices[0].delta.content;
                  
                  // Format the data to match what our frontend expects
                  const formattedData = {
                    choices: [
                      {
                        delta: {
                          content: parsed.choices[0].delta.content
                        }
                      }
                    ]
                  };
                  controller.enqueue(encoder.encode(JSON.stringify(formattedData) + '\n'));
                }
              } catch (e) {
                console.error('Error parsing Groq chunk:', e, 'Line:', trimmedLine);
                // Continue processing other chunks rather than failing
              }
            }
          }
        } catch (error) {
          console.error('Error in transform:', error);
          // Send error but don't terminate the stream
          controller.enqueue(encoder.encode(JSON.stringify({
            choices: [{ delta: { content: "\n\nI apologize, but I encountered an issue processing your request. Please try again." } }]
          }) + '\n'));
        }
      },
      
      // Make sure to process any remaining data in the buffer
      flush(controller) {
        try {
          if (buffer.trim()) {
            if (buffer.trim().startsWith('data: ')) {
              const data = buffer.trim().slice(6);
              if (data !== '[DONE]') {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.choices && parsed.choices[0]?.delta?.content) {
                    const formattedData = {
                      choices: [
                        {
                          delta: {
                            content: parsed.choices[0].delta.content
                          }
                        }
                      ]
                    };
                    controller.enqueue(encoder.encode(JSON.stringify(formattedData) + '\n'));
                  }
                } catch (e) {
                  console.error('Error in flush:', e);
                }
              }
            }
          }
          
          console.log(`Completed Groq response, generated ${contentAccumulator.length} characters`);
        } catch (error) {
          console.error('Error in flush:', error);
        }
      }
    });

    // Add a timeout for the entire streaming process
    const streamTimeoutController = new AbortController();
    const { signal } = streamTimeoutController;
    setTimeout(() => streamTimeoutController.abort(), 50000); // 50 seconds
    
    try {
      // Pipe the response through our transform stream with timeout
      const responseStream = groqResponse.body?.pipeThrough(transformStream, { signal });
      
      if (!responseStream) {
        return new Response(JSON.stringify({ error: 'Failed to process stream' }), { status: 500 });
      }

      return new Response(responseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Groq streaming aborted due to timeout');
        return new Response(JSON.stringify({ error: 'Streaming timed out' }), { status: 504 });
      }
      throw error; // Rethrow other errors to be caught by the outer catch
    }
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