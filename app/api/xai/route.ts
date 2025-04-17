import { NextRequest, NextResponse } from 'next/server';
import { Message } from '@/app/types'; // Adjust path if necessary

export const runtime = 'edge'; // Use edge runtime for streaming

// Placeholder for xAI API Key - Load securely from environment variables
const XAI_API_KEY = process.env.XAI_API_KEY;
const API_ENDPOINT = 'https://api.x.ai/v1/chat/completions'; // Assumed endpoint
const encoder = new TextEncoder();

// Helper function to format messages for the API
function formatMessages(messages: Message[], query: string): any[] {
  // Format previous messages, assuming roles are already compatible ('user', 'assistant')
  const formatted: any[] = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));
  // Add the latest user query
  formatted.push({ role: 'user', content: query });
  return formatted;
}

export async function POST(req: NextRequest) {
  if (!XAI_API_KEY) {
    return NextResponse.json({ error: 'xAI API key not configured.' }, { status: 500 });
  }

  try {
    const body = await req.json();
    // Extract the last user query explicitly if needed, or rely on full messages array
    // Assuming 'query' in the body is the *latest* user message not yet in the messages array
    const { query, model, messages }: { query: string, model: string, messages: Message[] } = body;

    if (!query || !model) {
      return NextResponse.json({ error: 'Missing query or model in request body' }, { status: 400 });
    }
    
    // Format messages for the xAI API
    const formattedMessages = formatMessages(messages || [], query);

    const xaiPayload = {
      model: model,
      messages: formattedMessages,
      stream: true,
      // Add any other parameters supported by xAI (e.g., temperature, max_tokens) if needed
      // temperature: 0.7,
      // max_tokens: 1024,
    };

    console.log(`Sending request to xAI: Model=${model}, Messages=${formattedMessages.length}`);

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Accept': 'text/event-stream' // Important for streaming
      },
      body: JSON.stringify(xaiPayload),
      cache: 'no-store' // Ensure fresh response
    });

    if (!response.ok) {
      // Attempt to read error details from the response body
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch { /* Ignore if reading body fails */ }
      console.error(`xAI API Error: ${response.status} ${response.statusText}`, errorBody);
      return NextResponse.json({ error: `xAI API error: ${response.status} ${response.statusText} ${errorBody}`.trim() }, { status: response.status });
    }

    // Handle the response stream using a TransformStream for robust handling
    const transformer = createOpenAIStreamTransformer(); // Using a reusable transformer

    if (!response.body) {
       throw new Error("Response body is null");
    }

    // Pipe the response through the transformer
    const stream = response.body.pipeThrough(transformer);

    // Return the processed stream
    return new NextResponse(stream, {
      headers: { 
        'Content-Type': 'text/event-stream', 
        'Cache-Control': 'no-cache', 
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Optional: Disable buffering in proxies like Nginx
      },
    });

  } catch (error) {
    console.error('Error in xAI API route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Failed to process request: ${errorMessage}` }, { status: 500 });
  }
}

// Reusable TransformStream for OpenAI-compatible SSE streams
function createOpenAIStreamTransformer() {
  let buffer = '';
  let isFirstChunk = true;

  return new TransformStream({
    transform(chunk, controller) {
      buffer += new TextDecoder().decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;

        const data = line.slice(6);
        if (data === '[DONE]') {
          controller.terminate(); // End the stream
          return;
        }

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta;

          if (delta && (delta.content || (isFirstChunk && delta.role))) { // Include role in the first chunk if present
            const message = {
              choices: [
                {
                  delta: {
                    ...(isFirstChunk && delta.role && { role: delta.role }),
                    ...(delta.content && { content: delta.content }),
                  }
                }
              ]
            };
            controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));
            isFirstChunk = false; // Role only needed in the first chunk
          }
        } catch (e) {
          console.error('Error parsing xAI stream chunk:', e, 'Line:', line);
          // Optionally enqueue an error message or just skip the chunk
          // controller.enqueue(encoder.encode(JSON.stringify({ error: "Error processing stream chunk" }) + '\n'));
        }
      }
    },
    flush(controller) {
      // Process any remaining buffer content (though unlikely with SSE)
      if (buffer.trim().startsWith('data: ')) {
         const data = buffer.slice(6);
         if (data !== '[DONE]') {
            try {
              // Attempt to process the last chunk
               const json = JSON.parse(data);
               const delta = json.choices?.[0]?.delta;
               if (delta && delta.content) {
                  const message = { choices: [{ delta: { content: delta.content } }] };
                  controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));
               }
            } catch (e) {
               console.error('Error parsing final xAI stream chunk:', e, 'Buffer:', buffer);
            }
         }
      }
      // Ensure termination if not already done
      controller.terminate(); 
    }
  });
}
