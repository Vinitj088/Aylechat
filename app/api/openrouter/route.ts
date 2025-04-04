import { NextRequest } from 'next/server';
// import { Message } from '@/app/types'; // No longer needed if using CoreMessage
import { CoreMessage, streamText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// Change dynamic to auto to enable edge runtime optimizations
export const dynamic = 'auto';
export const maxDuration = 60; // Maximum allowed for Vercel Hobby plan

// // Pre-define constants and encoder outside the handler for better performance - Not needed with ai-sdk
// const API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
// const encoder = new TextEncoder();

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

// // Model mapping - The model ID is now passed directly to the provider
// const MODEL_MAPPING: Record<string, string> = {
//   'google/gemma-3-27b-it:free': 'google/gemma-3-27b-it:free',
//   'mistralai/mistral-small-3.1-24b-instruct:free': 'mistralai/mistral-small-3.1-24b-instruct:free',
//   'deepseek/deepseek-r1:free': 'deepseek/deepseek-r1:free',
//   'deepseek/deepseek-chat-v3-0324:free': 'deepseek/deepseek-chat-v3-0324:free',
// };

// // Create a stream transformer to process the chunks efficiently - Not needed with ai-sdk
// const createStreamTransformer = () => { ... };
// // function processLineToController(line: string, controller: TransformStreamDefaultController) { ... }

export async function POST(req: NextRequest) {
  let model: string = ''; // Declare model outside try block

  try {
    // Parse request body first
    const body = await req.json();
    
    // Handle warmup requests quickly
    if (body.warmup === true) {
      return handleWarmup();
    }
    
    const { query, model: bodyModel, messages } = body;
    
    if (!query && (!messages || messages.length === 0)) { // Require either query or messages
      return new Response(JSON.stringify({ error: 'query or messages is required' }), { status: 400 });
    }
    if (!bodyModel) {
      return new Response(JSON.stringify({ error: 'model is required' }), { status: 400 });
    }

    // Log request
    console.log(`OpenRouter request: ${bodyModel} [${messages?.length || 0} msgs]`);
    
    const API_KEY = process.env.OPENROUTER_API_KEY;
    const REFERRER = 'https://exachat.vercel.app/'; // Keep referrer for OpenRouter headers
    const TITLE = 'ExaChat'; // Keep title for OpenRouter headers
    
    if (!API_KEY) {
      throw new Error('OPENROUTER_API_KEY environment variable not set');
    }
    
    // Initialize the OpenRouter provider with API key and custom headers
    const openrouter = createOpenRouter({
        apiKey: API_KEY,
        headers: {
            'HTTP-Referer': REFERRER,
            'X-Title': TITLE,
        },
        // You can add other provider options here if needed
        // generateId, // Optional: for custom request IDs
    });
    
    // Format messages for ai-sdk (CoreMessage format)
    let coreMessages: CoreMessage[] = [];
    if (messages && Array.isArray(messages)) {
      coreMessages = messages.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant', // Map roles
        content: msg.content || '', // Ensure content is a string
      }));
    }

    // If 'query' exists and it's not the last message, add it
    if (query && (coreMessages.length === 0 || coreMessages[coreMessages.length - 1].content !== query)) {
       coreMessages.push({ role: 'user', content: query });
    }

    // Check if messages array is empty after processing
    if (coreMessages.length === 0) {
        return new Response(JSON.stringify({ error: 'Cannot process empty query or messages' }), { status: 400 });
    }
    
    // Call streamText with the provider instance, model, messages, and settings
    const result = await streamText({
      model: openrouter(bodyModel), // Pass the requested model ID directly
      messages: coreMessages,
      // Map generation parameters
      temperature: 0.5, // From original params
      maxTokens: 2500,  // From original params (max_tokens)
      topP: 1,        // From original params (top_p)
      // Other parameters like frequencyPenalty, presencePenalty can be added if needed
    });
    
    // Respond with the stream using ai-sdk's helper
    return result.toDataStreamResponse();

  } catch (error: any) {
    console.error('OpenRouter API error (ai-sdk):', error);

    // Use ai-sdk compatible error handling
    const errorMsg = error.message || error.toString();
    let status = 500;
    let errorResponse = {
      error: 'Failed to process OpenRouter request.',
      message: 'An unexpected error occurred. Please try again.',
      details: errorMsg, // Include original error message for debugging
    };

    // Check for specific error types (adapt based on how @openrouter/ai-sdk-provider throws errors)
    if (error.cause) { // Check wrapped errors
        console.error('Error Cause:', error.cause);
        if (error.message.includes('authentication failed') || error.message.includes('Invalid API Key')) {
            status = 401; // Unauthorized
            errorResponse.error = 'Invalid API Key';
            errorResponse.message = 'The provided OPENROUTER_API_KEY is invalid or missing.';
        } else if (error.message.includes('not found') || error.message.includes('404')) {
             status = 404; // Not Found
             errorResponse.error = `Model not found: "${model || 'unknown'}"`;
             errorResponse.message = 'The requested model is unavailable on OpenRouter or does not exist.';
        } else if (error.message.includes('429') || error.message.includes('rate limit')) {
             status = 429; // Too Many Requests
             errorResponse.error = 'Rate limit exceeded';
             errorResponse.message = 'You have exceeded the rate limit for the OpenRouter API. Please try again later.';
        }
        // Add more specific OpenRouter error checks if needed
    } else if (errorMsg.includes('OPENROUTER_API_KEY environment variable not set')) {
        status = 500; // Internal Server Error (configuration issue)
        errorResponse.error = 'Configuration Error';
        errorResponse.message = 'The OpenRouter API key is not configured on the server.';
    }

    return new Response(
      JSON.stringify(errorResponse), 
      { status: status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// // Removed processLineToController function as it's no longer needed

// // Process a line and send it to the transform controller
// function processLineToController(line: string, controller: TransformStreamDefaultController) {
//   if (!line.startsWith('data: ')) return;
//   
//   const data = line.slice(6);
//   
//   // The "data: [DONE]" line indicates the end of the stream
//   if (data === '[DONE]') return;
//   
//   try {
//     // Handle potential JSON parsing errors with more specific error recovery
//     let json;
//     try {
//       json = JSON.parse(data);
//     } catch (parseError) {
//       // If JSON parsing fails, this might be an incomplete chunk
//       // Try to fix common JSON parsing issues
//       if (data.endsWith('"}')) {
//         // Sometimes the closing brace for the object is missing
//         try {
//           json = JSON.parse(data + '}');
//         } catch {
//           // If still failing, ignore this chunk
//           return;
//         }
//       } else {
//         // For other parsing errors, just skip this chunk
//         return;
//       }
//     }
//     
//     const delta = json.choices?.[0]?.delta;
//     
//     if (delta && delta.content) {
//       const message = {
//         choices: [
//           {
//             delta: {
//               content: delta.content
//             }
//           }
//         ]
//       };
//       
//       const encodedMessage = encoder.encode(JSON.stringify(message) + '\n');
//       controller.enqueue(encodedMessage);
//     }
//   } catch (error) {
//     // Last resort error handler - silently continue
//     return;
//   }
// } 