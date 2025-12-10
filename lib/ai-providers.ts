import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import modelsConfig from '../models.json';

// Type for provider IDs
type ProviderId = 'google' | 'groq' | 'openrouter' | 'cerebras' | 'xai' | 'perplexity' | 'inception' | 'together';

// Create provider instances - all OpenAI-compatible except Google
const providers: Record<ProviderId, ReturnType<typeof createOpenAI> | ReturnType<typeof createGoogleGenerativeAI>> = {
  google: createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_AI_API_KEY,
  }),
  groq: createOpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  }),
  openrouter: createOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://exachat.vercel.app/',
      'X-Title': 'Ayle Chat',
    },
  }),
  cerebras: createOpenAI({
    apiKey: process.env.CEREBRAS_API_KEY,
    baseURL: 'https://api.cerebras.ai/v1',
  }),
  xai: createOpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  }),
  perplexity: createOpenAI({
    apiKey: process.env.PPLX_API_KEY,
    baseURL: 'https://api.perplexity.ai',
  }),
  inception: createOpenAI({
    apiKey: process.env.INCEPTION_API_KEY,
    baseURL: 'https://api.inceptionlabs.ai/v1',
  }),
  together: createOpenAI({
    apiKey: process.env.TOGETHER_API_KEY,
    baseURL: 'https://api.together.xyz/v1',
  }),
};

// Get model configuration
export function getModelConfig(modelId: string) {
  return modelsConfig.models.find((m) => m.id === modelId);
}

// Get provider and model for a given model ID
export function getProviderModel(modelId: string) {
  const config = getModelConfig(modelId);
  const providerId = (config?.providerId || 'groq') as ProviderId;
  const provider = providers[providerId];

  // Return the language model instance
  return provider(modelId);
}

// Check if model is an image generation model
export function isImageGenerationModel(modelId: string): boolean {
  const config = getModelConfig(modelId);
  return !!config?.imageGenerationMode;
}

// Check if model supports search mode
export function isSearchModel(modelId: string): boolean {
  const config = getModelConfig(modelId);
  return !!config?.searchMode;
}

// Get provider ID for a model
export function getProviderId(modelId: string): ProviderId {
  const config = getModelConfig(modelId);
  return (config?.providerId || 'groq') as ProviderId;
}
