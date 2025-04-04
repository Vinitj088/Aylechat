import { NextRequest } from 'next/server';
import { CoreMessage, streamText, appendResponseMessages, type Message as UIMessage, CoreAssistantMessage, ToolContent } from 'ai';
import { RedisService } from '../../../lib/redis';

// Import provider SDKs
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createCerebras } from '@ai-sdk/cerebras';

// Import models config to determine provider
// Adjust the path '../../../' if your models.json is located differently relative to app/api/chat/
import modelsConfig from '../../../models.json';

// Optional: Set max duration for Vercel
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Helper type for streamText options
type StreamTextOptions = {
  model: any; // The specific provider model instance
  messages: CoreMessage[];
  system?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  // Add other potential parameters if needed
};

// Helper to get provider details from model ID
const getProviderDetails = (modelId: string) => {
  const modelInfo = modelsConfig.models.find(m => m.id === modelId);

  if (!modelInfo || modelInfo.providerId === 'exa') { // Explicitly exclude Exa
    // Handle unknown or excluded models
    console.warn(`Model config not found or excluded for ID: ${modelId}`);
    // Fallback logic based on previous route structures if needed, or throw error
    // For safety, let's throw an error if model isn't found or is Exa
     throw new Error(`Unsupported or unknown model ID for chat: ${modelId}`);
  }

  // Determine API key env variable based on providerId
  let apiKeyEnv = '';
  switch (modelInfo.providerId) {
    case 'google': apiKeyEnv = 'GOOGLE_AI_API_KEY'; break;
    case 'groq': apiKeyEnv = 'GROQ_API_KEY'; break;
    case 'openrouter': apiKeyEnv = 'OPENROUTER_API_KEY'; break;
    case 'cerebras': apiKeyEnv = 'CEREBRAS_API_KEY'; break;
    default: throw new Error(`Unsupported provider ID in models.json: ${modelInfo.providerId}`);
  }

  return {
      providerId: modelInfo.providerId,
      apiKeyEnv,
      // Pass back modelConfig details if needed for parameters
      modelConfig: modelInfo
    };
};

export async function POST(req: NextRequest) {
  // Store the original request messages for use in onFinish
  let requestMessages: UIMessage[] = [];
  let chatId: string | undefined = undefined; // Store chatId

  try {
    // model, id (chatId), systemPrompt etc. are expected in the body
    const body = await req.json();
    requestMessages = body.messages || []; // Get messages from body
    chatId = body.id; // Get chatId from body
    const model = body.model;
    const systemPrompt = body.systemPrompt;
    const enhance = body.enhance;
    // ... other params? ...

    if (!requestMessages || requestMessages.length === 0 || !model) {
      return new Response(JSON.stringify({ error: 'Missing messages or model in request body' }), { status: 400 });
    }
    // Ensure messages is an array
    if (!Array.isArray(requestMessages)) {
        return new Response(JSON.stringify({ error: 'Invalid messages format: must be an array' }), { status: 400 });
    }

    // TODO: Implement proper server-side userId retrieval
    const userId = "TODO-get-user-id-from-session"; // Placeholder

    if (!userId) {
      // Handle case where user is not authenticated server-side
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
    }

    const { providerId, apiKeyEnv, modelConfig } = getProviderDetails(model);
    const apiKey = process.env[apiKeyEnv];

    if (!apiKey) {
      console.error(`API key environment variable ${apiKeyEnv} not set`);
      return new Response(JSON.stringify({
          error: 'Configuration Error',
          message: `API key environment variable ${apiKeyEnv} not set on the server.`
      }), { status: 500 });
    }

    // Pre-process messages into CoreMessage format
    const coreMessages: CoreMessage[] = [];
    for (const msg of requestMessages) {
        let coreMsgToAdd: CoreMessage | null = null;

        if (msg.role === 'system') {
            coreMsgToAdd = { role: 'system', content: msg.content };
        } else if (msg.role === 'user') {
            coreMsgToAdd = { role: 'user', content: msg.content };
        } else if (msg.role === 'assistant') {
            // Construct CoreAssistantMessage directly
            const assistantMsg: CoreAssistantMessage = {
                role: 'assistant',
                content: msg.content,
            };
            coreMsgToAdd = assistantMsg;
        } else if (msg.role === 'function' || msg.role === 'tool') {
            const toolCallId = ('tool_call_id' in msg && typeof msg.tool_call_id === 'string') ? msg.tool_call_id : null;
            const toolName = ('name' in msg && typeof msg.name === 'string') ? msg.name : null;

            if (toolCallId && toolName) { // Require both toolCallId and a name for a valid tool result
                const toolContent: ToolContent = [
                    {
                        type: 'tool-result',
                        toolCallId: toolCallId,
                        toolName: toolName, // Add required toolName
                        result: msg.content
                    }
                ];
                coreMsgToAdd = {
                    role: 'tool',
                    content: toolContent,
                };
            } else {
                console.error('[map UIMessage->CoreMessage] Tool/Function message missing required string tool_call_id or name:', msg);
            }
        } else if (msg.role === 'data') {
             console.log('[map UIMessage->CoreMessage] Skipping message with role: data');
        } else {
            console.warn(`[map UIMessage->CoreMessage] Skipping message with unhandled role: ${msg.role}`);
        }

        if (coreMsgToAdd) {
            coreMessages.push(coreMsgToAdd);
        }
    }

    // Ensure we have some messages left after processing
    if (coreMessages.length === 0) {
        return new Response(JSON.stringify({ error: 'No valid messages to process after filtering roles.' }), { status: 400 });
    }

    const streamOptions: StreamTextOptions = {
      model: null, // Will be set in the switch
      messages: coreMessages, // Use the pre-processed array
      system: systemPrompt,
      // Set default parameters first, potentially overridden by provider specifics
      temperature: 0.7,
      maxTokens: 4000,
      topP: 1,
    };

    // Provider-specific setup and parameters
    switch (providerId) {
      case 'google':
        const google = createGoogleGenerativeAI({ apiKey });
        streamOptions.model = google(model);
        // Add specific params from previous Gemini route
        streamOptions.topK = 64;
        streamOptions.temperature = 0.7;
        // TODO: Add safety settings if required, similar to the previous Gemini route
        // Example: streamOptions.safetySettings = [...]
        break;
      case 'groq':
        const groq = createGroq({ apiKey });
        streamOptions.model = groq(model);
        // Add specific params from previous Groq route
        streamOptions.maxTokens = enhance ? 1000 : 4000;
        streamOptions.temperature = 0.5;
        streamOptions.topP = 1;
        break;
      case 'openrouter':
        const openrouter = createOpenRouter({
          apiKey: apiKey,
          headers: { // Headers from previous OpenRouter route
            'HTTP-Referer': process.env.APP_URL || 'https://exachat.vercel.app/', // Use env var or fallback
            'X-Title': 'ExaChat',
          },
        });
        streamOptions.model = openrouter(model);
        // Add specific params from previous OpenRouter route
        streamOptions.maxTokens = 2500;
        streamOptions.temperature = 0.5;
        streamOptions.topP = 1;
        break;
      case 'cerebras':
        const cerebras = createCerebras({ apiKey });
        streamOptions.model = cerebras(model);
         // Add specific params from previous Cerebras route
        streamOptions.maxTokens = enhance ? 1000 : 4000;
        streamOptions.temperature = 0.5;
        streamOptions.topP = 1;
        break;
      default:
        // This case should technically be unreachable due to getProviderDetails check
        throw new Error(`Internal error: Unsupported provider ${providerId}`);
    }

    // Remove undefined options before calling streamText to avoid potential issues
    Object.keys(streamOptions).forEach(key => (streamOptions as any)[key] === undefined && delete (streamOptions as any)[key]);

    // Define streamText call with onFinish for persistence
    const result = streamText({
        ...streamOptions, // Spread the existing options
        async onFinish({ response }) {
            // This runs after the stream completes
            if (chatId && userId) { // Only update if we have a chatId and userId
                 try {
                    // Combine original request messages with AI response messages
                    const finalMessages: UIMessage[] = appendResponseMessages({
                         messages: requestMessages, // Use original request messages (UIMessage[])
                         responseMessages: response.messages, // AI response messages (CoreMessage[])
                    });

                    // Update the thread in Redis
                    await RedisService.updateChatThread(userId, chatId, { messages: finalMessages });
                    console.log(`Chat thread ${chatId} updated successfully.`);
                 } catch (saveError) {
                     console.error(`Failed to save chat thread ${chatId}:`, saveError);
                     // Decide if/how to handle save errors (e.g., log, alert)
                 }
            } else {
                 console.warn(`Skipping chat save: chatId (${chatId}) or userId (${userId}) is missing.`);
                 // Handle new chats? For now, we assume existing chats are updated here.
                 // New chat creation might still happen via dedicated thread routes initiated by the client.
            }
        },
    });

    // Consume the stream in the background to ensure onFinish runs
    // even if the client disconnects. Do not await this.
    result.consumeStream();

    // Return the stream response to the client
    return result.toDataStreamResponse();

  } catch (error: any) {
    console.error('/api/chat error:', error);
    // Standardized error response
    const errorMsg = error.message || error.toString();
    let status = 500;
    let errorResponse = {
      error: 'Failed to process chat request.',
      message: 'An unexpected error occurred on the server.',
      details: errorMsg, // Include details for debugging (consider removing in production)
    };

     // Check for specific error types
     if (errorMsg.includes('API key') || errorMsg.includes('authentication') || error.status === 401) {
       status = 401;
       errorResponse.error = 'Authentication Error';
       errorResponse.message = 'Invalid or missing API key configuration.';
     } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
       status = 404;
       errorResponse.error = 'Model Not Found';
       errorResponse.message = `The requested model (${(error as any)?.model || 'unknown'}) is unavailable or not supported.`;
     } else if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
        status = 429;
        errorResponse.error = 'Rate Limit Exceeded';
        errorResponse.message = 'API rate limit exceeded. Please try again later.';
     } else if (errorMsg.includes('Unsupported or unknown model ID')) {
         status = 400; // Bad Request
         errorResponse.error = 'Invalid Model';
         errorResponse.message = errorMsg;
     } else if (errorMsg.includes('environment variable not set')) {
         status = 500;
         errorResponse.error = 'Configuration Error';
         errorResponse.message = errorMsg; // Keep specific message
     } else if (errorMsg.includes('TODO-get-user-id')) {
         status = 500;
         errorResponse.error = 'Server Configuration Error';
         errorResponse.message = 'User authentication could not be determined.';
     }

    return new Response(JSON.stringify(errorResponse), {
      status: status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
