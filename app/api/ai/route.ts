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
    const requestBody = await req.json();
    const {
      messages, // This is the primary message history from useChat
      chatId,   // Optional, from useChat's id parameter
      selectedModel, // Custom parameter for model selection
      attachments, // Custom parameter for attachments
      activeChatFiles, // Custom parameter for active files
      ...otherOptions // any other options passed in the body
    } = requestBody;

    const modelId = selectedModel; // Rename for clarity

    if (!modelId || !messages) {
      return new Response(JSON.stringify({ error: 'Missing modelId or messages' }), { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages must be a non-empty array' }), { status: 400 });
    }

    let processedMessages = messages;

    // Simplified Attachment Processing:
    // Log a warning if custom 'attachments' are present, as full multi-modal processing
    // for this custom structure is not implemented here.
    // The Vercel AI SDK expects attachments to be part of the message content for some providers.
    if (attachments && attachments.length > 0 && processedMessages.length > 0) {
      const lastMessageIndex = processedMessages.length - 1;
      if (processedMessages[lastMessageIndex].role === 'user') {
        console.warn("/api/ai received 'attachments' in the request body. This custom 'attachments' field is not automatically processed into multi-modal messages by this generic handler. Ensure the client sends files appropriately formatted within the 'messages' array (e.g., for Gemini, as content parts with image data) if vision capabilities are expected from the model via this endpoint.");
        // Example of what might be needed if 'attachments' contained image data:
        // const lastUserMessage = processedMessages[lastMessageIndex];
        // let contentParts = [];
        // if (typeof lastUserMessage.content === 'string') {
        //   contentParts.push({ type: 'text', text: lastUserMessage.content });
        // } else if (Array.isArray(lastUserMessage.content)) {
        //   contentParts = [...lastUserMessage.content];
        // }
        // attachments.forEach(att => {
        //   if (att.type && att.type.startsWith('image/') && att.data) { // Assuming att.data would be base64
        //     contentParts.push({ type: 'image', image: att.data, mimeType: att.type });
        //   }
        // });
        // processedMessages[lastMessageIndex] = { ...lastUserMessage, content: contentParts };
      }
    }

    const providerModel = getProviderModel(modelId);

    // Filter 'otherOptions' to only include valid streamText parameters if necessary
    // For now, we pass common ones if they exist, similar to the original spread of 'rest'
    const streamTextOptions: any = {
      model: providerModel,
      messages: processedMessages,
    };

    if (otherOptions.temperature !== undefined) {
      streamTextOptions.temperature = otherOptions.temperature;
    }
    if (otherOptions.maxTokens !== undefined) {
      streamTextOptions.maxTokens = otherOptions.maxTokens;
    }
    if (otherOptions.system !== undefined) {
      streamTextOptions.system = otherOptions.system;
    }
    // Add other valid streamText options from otherOptions as needed

    const result = streamText(streamTextOptions);

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