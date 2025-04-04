import { NextRequest } from 'next/server';
// import { Message } from '@/app/types'; // No longer needed
import { CoreMessage, streamText } from 'ai';
import { createCerebras } from '@ai-sdk/cerebras';

// Change dynamic to auto to enable optimization
export const dynamic = 'auto';
export const maxDuration = 60; // Maximum allowed for Vercel Hobby plan

// // Pre-define constants and encoder outside the handler for better performance - Not needed
// const API_ENDPOINT = 'https://api.cerebras.ai/v1/chat/completions';
// const encoder = new TextEncoder();

// Handle warmup requests specially
const handleWarmup = () => {
  return new Response(
    JSON.stringify({ status: 'warmed_up' }),
    { status: 200 }
  );
};

// // Create a stream transformer to process the chunks efficiently - Not needed
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

    // Extract relevant fields from the body
    const { query, model: bodyModel, messages, enhance, systemPrompt } = body;
    model = bodyModel || ''; // Assign to outer scope variable

    // Validate required fields
    if (!query && (!messages || messages.length === 0)) {
      return new Response(JSON.stringify({ error: 'query or messages is required' }), { status: 400 });
    }
    if (!model) {
      return new Response(JSON.stringify({ error: 'model is required' }), { status: 400 });
    }

    // Log request
    console.log(`Cerebras request: ${model} [${messages?.length || 0} msgs]`);

    // Get API key from environment
    const API_KEY = process.env.CEREBRAS_API_KEY;
    if (!API_KEY) {
      throw new Error('CEREBRAS_API_KEY environment variable not set');
    }

    // Initialize the Cerebras provider
    const cerebras = createCerebras({
      apiKey: API_KEY,
      // Add other provider options here if needed
    });

    // Format messages for ai-sdk (CoreMessage format)
    let coreMessages: CoreMessage[] = [];
    if (messages && Array.isArray(messages)) {
      coreMessages = messages.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content || '',
      }));
    }

    // Add the current query if it's not the last message
    if (query && (coreMessages.length === 0 || coreMessages[coreMessages.length - 1].content !== query)) {
      coreMessages.push({ role: 'user', content: query });
    }

    // Ensure there are messages to send
    if (coreMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'Cannot process empty query or messages' }), { status: 400 });
    }

    // Call streamText with the provider instance, model, messages, and settings
    const result = await streamText({
      model: cerebras(model), // Pass the model ID to the provider instance
      messages: coreMessages,
      system: systemPrompt, // Pass system prompt if provided
      // Map generation parameters from original request
      temperature: 0.5,
      maxTokens: enhance ? 1000 : 4000, // Adjust based on enhance flag
      topP: 1,
    });

    // Respond with the stream using ai-sdk helper
    return result.toDataStreamResponse();

  } catch (error: any) {
    console.error('Cerebras API error (ai-sdk):', error);

    // Use ai-sdk compatible error handling
    const errorMsg = error.message || error.toString();
    let status = 500;
    let errorResponse = {
      error: 'Failed to process Cerebras request.',
      message: 'An unexpected error occurred. Please try again.',
      details: errorMsg,
    };

    // Check for specific error types (adapt based on @ai-sdk/cerebras errors)
    if (error.cause) { // Check wrapped errors
      console.error('Error Cause:', error.cause);
      if (error.message.includes('authentication failed') || error.message.includes('Invalid API Key')) {
        status = 401;
        errorResponse.error = 'Invalid API Key';
        errorResponse.message = 'The provided CEREBRAS_API_KEY is invalid or missing.';
      } else if (error.message.includes('not found') || error.message.includes('404')) {
        status = 404;
        errorResponse.error = `Model not found: "${model || 'unknown'}"`;
        errorResponse.message = 'The requested model is unavailable on Cerebras or does not exist.';
      } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        status = 429;
        errorResponse.error = 'Rate limit exceeded';
        errorResponse.message = 'You have exceeded the rate limit for the Cerebras API. Please try again later.';
      }
      // Add more specific Cerebras error checks if needed
    } else if (errorMsg.includes('CEREBRAS_API_KEY environment variable not set')) {
      status = 500;
      errorResponse.error = 'Configuration Error';
      errorResponse.message = 'The Cerebras API key is not configured on the server.';
    }

    // Return JSON error response
    return new Response(
      JSON.stringify(errorResponse),
      { status: status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// // Removed processLineToController function