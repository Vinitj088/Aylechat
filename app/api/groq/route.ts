import { NextRequest } from 'next/server';
// import { Message } from '@/app/types'; // No longer needed if using CoreMessage
import { CoreMessage, streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

// Change dynamic to auto to enable optimization
export const dynamic = 'auto';
export const maxDuration = 60; // Maximum allowed for Vercel Hobby plan

// // Pre-define constants and encoder outside the handler for better performance - Not needed with ai-sdk
// const API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
// const encoder = new TextEncoder();

// Handle warmup requests specially
const handleWarmup = () => {
  return new Response(
    JSON.stringify({ status: 'warmed_up' }),
    { status: 200 }
  );
};

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

    const { query, model: bodyModel, messages, enhance, systemPrompt } = body;
    model = bodyModel || ''; // Assign to outer scope model variable

    if (!query && (!messages || messages.length === 0)) { // Require either query or messages
      return new Response(JSON.stringify({ error: 'query or messages is required' }), { status: 400 });
    }
    if (!model) {
      return new Response(JSON.stringify({ error: 'model is required' }), { status: 400 });
    }

    // Log request
    console.log(`Groq request: ${model} [${messages?.length || 0} msgs]`);

    const API_KEY = process.env.GROQ_API_KEY;

    if (!API_KEY) {
      throw new Error('GROQ_API_KEY environment variable not set');
    }

    // Initialize the Groq provider
    const groq = createGroq({
      apiKey: API_KEY,
      // Add other provider options if needed
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
      model: groq(model), // Pass the requested model ID directly
      messages: coreMessages,
      system: systemPrompt, // Pass the system prompt if provided
      // Map generation parameters
      temperature: 0.5, // From original params
      maxTokens: enhance ? 1000 : 4000, // Use smaller max_tokens for enhancements (from original params)
      topP: 1, // From original params (top_p)
      // Other parameters like frequencyPenalty, presencePenalty can be added if needed
    });

    // Respond with the stream using ai-sdk's helper
    return result.toDataStreamResponse();

  } catch (error: any) {
    console.error('Groq API error (ai-sdk):', error);

    // Use ai-sdk compatible error handling
    const errorMsg = error.message || error.toString();
    let status = 500;
    let errorResponse = {
      error: 'Failed to process Groq request.',
      message: 'An unexpected error occurred. Please try again.',
      details: errorMsg, // Include original error message for debugging
    };

    // Check for specific error types (adapt based on how @ai-sdk/groq throws errors)
    if (error.cause) { // Check wrapped errors
      console.error('Error Cause:', error.cause);
      if (error.message.includes('authentication failed') || error.message.includes('Invalid API Key')) {
        status = 401; // Unauthorized
        errorResponse.error = 'Invalid API Key';
        errorResponse.message = 'The provided GROQ_API_KEY is invalid or missing.';
      } else if (error.message.includes('not found') || error.message.includes('404')) {
        status = 404; // Not Found
        errorResponse.error = `Model not found: "${model || 'unknown'}"`;
        errorResponse.message = 'The requested model is unavailable on Groq or does not exist.';
      } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        status = 429; // Too Many Requests
        errorResponse.error = 'Rate limit exceeded';
        errorResponse.message = 'You have exceeded the rate limit for the Groq API. Please try again later.';
      }
      // Add more specific Groq error checks if needed
    } else if (errorMsg.includes('GROQ_API_KEY environment variable not set')) {
      status = 500; // Internal Server Error (configuration issue)
      errorResponse.error = 'Configuration Error';
      errorResponse.message = 'The Groq API key is not configured on the server.';
    }

    return new Response(
      JSON.stringify(errorResponse),
      { status: status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}