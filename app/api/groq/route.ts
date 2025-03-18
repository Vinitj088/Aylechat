import { NextRequest } from 'next/server';
import { authService } from '@/lib/auth-service';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated
    const user = await authService.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { query, model, messages } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
    }
    if (!model) {
      return new Response(JSON.stringify({ error: 'model is required' }), { status: 400 });
    }

    // Groq API endpoint
    const groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
    
    // Get API key from environment variable
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY is not configured' }), { status: 500 });
    }

    // Format messages for Groq API in the correct format
    const formattedMessages = messages && messages.length > 0 
      ? messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      // If no messages history is provided, just use the query
      : [{ role: 'user', content: query }];

    // Prepare the request to Groq API
    const groqResponse = await fetch(groqEndpoint, {
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

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json();
      return new Response(JSON.stringify({ error: `Groq API error: ${errorData.error?.message || 'Unknown error'}` }), { 
        status: groqResponse.status 
      });
    }

    // Create a TransformStream to process the SSE data from Groq
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Buffer to accumulate partial chunks
    let buffer = '';
    
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
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
              // Silently ignore parsing errors for incomplete chunks
              // They will be handled when we get complete chunks
            }
          }
        }
      },
      
      // Make sure to process any remaining data in the buffer
      flush(controller) {
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
                // Ignore parsing errors in the final flush
              }
            }
          }
        }
      }
    });

    // Pipe the response through our transform stream
    const responseStream = groqResponse.body?.pipeThrough(transformStream);
    
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
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: `Failed to perform Groq request | ${error.message}` }), 
      { status: 500 }
    );
  }
} 