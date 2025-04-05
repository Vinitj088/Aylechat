import { NextRequest } from 'next/server';
import { Message } from '@/app/types';

// Ensure route is always dynamic
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Maximum allowed for Vercel Hobby plan

// Pre-define constants and encoder outside the handler for better performance
const API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const encoder = new TextEncoder();

// Handle warmup requests specially
const handleWarmup = () => {
  return new Response(
    JSON.stringify({ status: 'warmed_up' }),
    { status: 200 }
  );
};

/**
 * IMPORTANT: You need to add OPENROUTER_API_KEY to your environment variables
 * 
 * 1. Get an API key from https://openrouter.ai/
 * 2. Add it to your .env.local file as OPENROUTER_API_KEY=your_api_key
 * 3. If deploying to Vercel, also add it to your Vercel environment variables
 */

// Model mapping - this maps our internal model IDs to OpenRouter model IDs
const MODEL_MAPPING: Record<string, string> = {
  'google/gemma-3-27b-it:free': 'google/gemma-3-27b-it:free', // Gemma 3 27B model ID on OpenRouter with free variant
  'mistralai/mistral-small-3.1-24b-instruct:free': 'mistralai/mistral-small-3.1-24b-instruct:free',
  'deepseek/deepseek-r1:free': 'deepseek/deepseek-r1:free',
  'deepseek/deepseek-chat-v3-0324:free': 'deepseek/deepseek-chat-v3-0324:free',
};

// Create a stream transformer to process the chunks efficiently
const createStreamTransformer = () => {
  let buffer = '';
  
  return new TransformStream({
    transform(chunk, controller) {
      // Add chunk to buffer
      buffer += new TextDecoder().decode(chunk, { stream: true });
      
      // Split by newlines
      const lines = buffer.split('\n');
      
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || '';
      
      // Process each complete line
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          processLineToController(line, controller);
        } catch (e) {
          // Silently continue on errors
        }
      }
    },
    
    flush(controller) {
      // Process any remaining buffer content
      if (buffer.trim()) {
        try {
          processLineToController(buffer, controller);
        } catch (e) {
          // Silently ignore parsing errors at the end
        }
      }
    }
  });
};

export async function POST(req: NextRequest) {
  try {
    // Parse request body first
    const body = await req.json();
    
    // Handle warmup requests quickly
    if (body.warmup === true) {
      return handleWarmup();
    }
    
    const { query, model, messages } = body;
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
    }
    if (!model) {
      return new Response(JSON.stringify({ error: 'model is required' }), { status: 400 });
    }

    // Skip authentication checks - allow all requests
    console.log(`OpenRouter request: ${model} [${messages?.length || 0} msgs]`);
    
    const API_KEY = process.env.OPENROUTER_API_KEY;
    const REFERRER = 'https://exachat.vercel.app/';
    
    if (!API_KEY) {
      throw new Error('OPENROUTER_API_KEY environment variable not set');
    }
    
    // Add role to messages 
    const formattedMessages = [{ role: 'user', content: query }];
    
    // Parameters for OpenRouter API
    const params = {
      messages: formattedMessages,
      model: model,
      temperature: 0.5,
      max_tokens: 2500,
      stream: true,
      top_p: 1,
    };
    
    // Call the OpenRouter API for streaming
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': REFERRER,
        'X-Title': 'ExaChat',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(params),
      cache: 'no-store'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
    }
    
    // Create the transform stream
    const transformer = createStreamTransformer();
    
    // Pipe the response through our transformer
    return new Response(response.body?.pipeThrough(transformer), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable buffering in Nginx
      }
    });
  } catch (error: any) {
    console.error('OpenRouter error:', error.message);
    return new Response(
      JSON.stringify({ 
        error: `Failed to process request: ${error.message}`,
        message: "I apologize, but I couldn't complete your request. Please try again."
      }), 
      { status: 500 }
    );
  }
}

// Process a line and send it to the transform controller
function processLineToController(line: string, controller: TransformStreamDefaultController) {
  if (!line.startsWith('data: ')) return;
  
  const data = line.slice(6);
  
  // The "data: [DONE]" line indicates the end of the stream
  if (data === '[DONE]') return;
  
  try {
    // Handle potential JSON parsing errors with more specific error recovery
    let json;
    try {
      json = JSON.parse(data);
    } catch (parseError) {
      // If JSON parsing fails, this might be an incomplete chunk
      // Try to fix common JSON parsing issues
      if (data.endsWith('"}')) {
        // Sometimes the closing brace for the object is missing
        try {
          json = JSON.parse(data + '}');
        } catch {
          // If still failing, ignore this chunk
          return;
        }
      } else {
        // For other parsing errors, just skip this chunk
        return;
      }
    }
    
    const delta = json.choices?.[0]?.delta;
    
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
      
      const encodedMessage = encoder.encode(JSON.stringify(message) + '\n');
      controller.enqueue(encodedMessage);
    }
  } catch (error) {
    // Last resort error handler - silently continue
    return;
  }
} 