import { streamText, convertToCoreMessages, CoreMessage, smoothStream } from 'ai';
import { getProviderModel, getProviderId, isImageGenerationModel } from '@/lib/ai-providers';
import { aiTools } from '@/lib/ai-tools';
import { selectSystemPrompt } from '@/lib/context-manager';

// Allow streaming for up to 60 seconds
export const maxDuration = 60;

// Use edge runtime for faster cold starts and streaming
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, model: modelId, data } = body;

    // Validate required fields
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!modelId) {
      return new Response(JSON.stringify({ error: 'Model ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if this is an image generation model - handle separately
    if (isImageGenerationModel(modelId)) {
      return handleImageGeneration(modelId, messages);
    }

    // Get the last user message for system prompt selection
    const lastUserMessage = [...messages].reverse().find((m: CoreMessage) => m.role === 'user');
    const lastContent = typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content
      : '';

    // Select appropriate system prompt based on query complexity
    const systemPrompt = selectSystemPrompt(lastContent);

    // Get provider-specific model instance
    const aiModel = getProviderModel(modelId);
    const providerId = getProviderId(modelId);

    // Determine if tools should be enabled for this model
    // Disable tools for models that don't support them well or for search models
    const enableTools = !['perplexity', 'inception'].includes(providerId);

    // Convert messages to core format
    const coreMessages = convertToCoreMessages(messages);

    // Stream the response with smooth streaming for better UX
    const result = streamText({
      model: aiModel,
      system: systemPrompt,
      messages: coreMessages,
      ...(enableTools && {
        tools: aiTools,
        maxSteps: 3, // Allow up to 3 tool calls in sequence
      }),
      // Provider-specific options
      ...(providerId === 'perplexity' && {
        // Perplexity-specific options - they handle search internally
      }),
      // Smooth streaming for better perceived performance
      experimental_transform: smoothStream({
        delayInMs: 10, // Small delay for smoother text appearance
      }),
      onFinish: ({ text, usage, finishReason }) => {
        // Optional: Log completion for debugging
        console.log(`[Chat] Model: ${modelId}, Finish: ${finishReason}, Tokens: ${usage?.totalTokens || 'N/A'}`);
      },
    });

    // Return the data stream response with proper headers for streaming
    return result.toDataStreamResponse({
      headers: {
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (error) {
    console.error('[Chat API Error]', error);

    // Return errors in AI SDK data stream format so useChat can handle them properly
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    // Determine status code
    let statusCode = 500;
    if (error instanceof Error) {
      if (error.message.includes('429')) statusCode = 429;
      else if (error.message.includes('401')) statusCode = 401;
    }

    // Return error in data stream format: 3:{"error":"message"}\n
    const errorStream = `3:${JSON.stringify(errorMessage)}\n`;

    return new Response(errorStream, {
      status: statusCode,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}

// Handle image generation (Together AI FLUX model)
async function handleImageGeneration(modelId: string, messages: CoreMessage[]) {
  try {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const prompt = typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content
      : '';

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'No prompt provided for image generation' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Call Together AI directly for image generation
    const response = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        prompt: prompt,
        width: 1024,
        height: 768,
        n: 1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Image generation failed: ${error}`);
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;

    // Return as a simple response with the image data
    return new Response(JSON.stringify({
      type: 'image',
      images: [{ url: imageUrl }],
      prompt: prompt,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Image Generation Error]', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Image generation failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
