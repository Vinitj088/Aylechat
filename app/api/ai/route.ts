import { streamText } from 'ai';
// Import all major providers from the AI SDK
import { openai } from '@ai-sdk/openai';
import { groq } from '@ai-sdk/groq';
import { google } from '@ai-sdk/google';
import { cerebras } from '@ai-sdk/cerebras';
import { xai } from '@ai-sdk/xai';
// Together is not available as an official AI SDK provider yet

// Helper: Map model string to provider instance
function getProviderModel(model: string) {
  if (!model) throw new Error('No model specified');
  // OpenAI and compatible
  if (model.startsWith('gpt-') || model.startsWith('openai')) return openai(model);
  // Groq
  if (model.includes('llama') || model.includes('mixtral') || model.includes('gemma') || model.includes('groq')) return groq(model);
  // Gemini/Google
  if (model.includes('gemini') || model.includes('google')) return google(model);
  // Cerebras
  if (model.includes('cerebras')) return cerebras(model);
  // XAI
  if (model.includes('xai') || model.includes('grok')) return xai(model);
  // Add more as needed
  throw new Error('Unknown or unsupported model: ' + model);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { model, messages, ...rest } = body;
    if (!model || !messages) {
      return new Response(JSON.stringify({ error: 'Missing model or messages' }), { status: 400 });
    }
    const providerModel = getProviderModel(model);
    // Optionally handle attachments, tool calls, etc. from rest
    const result = streamText({
      model: providerModel,
      messages,
      ...rest,
    });
    return result.toDataStreamResponse({
      getErrorMessage: (error) => {
        if (!error) return 'unknown error';
        if (typeof error === 'string') return error;
        if (error instanceof Error) return error.message;
        return JSON.stringify(error);
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500 });
  }
} 