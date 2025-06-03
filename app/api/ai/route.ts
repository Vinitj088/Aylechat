import { streamText } from "ai"
import { openai } from "@ai-sdk/openai"
import { groq } from "@ai-sdk/groq"
import { google } from "@ai-sdk/google"
import { cerebras } from "@ai-sdk/cerebras"
import { xai } from "@ai-sdk/xai"
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import Exa from 'exa-js'

// Import the models configuration
import modelsData from "../../../models.json"

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
})
const exa = new Exa(process.env.EXA_API_KEY!)

// Helper: Map model string to provider instance based on models.json
function getProviderModel(modelId: string) {
  if (!modelId) throw new Error("No model specified")

  console.log("Mapping model:", modelId)

  // Find the model in our models.json configuration
  const modelConfig = modelsData.models.find((model) => model.id === modelId)

  if (modelConfig) {
    console.log(`Found model config for ${modelId}:`, modelConfig)

    switch (modelConfig.providerId) {
      case "openrouter":
        console.log("Using OpenRouter provider for:", modelId)
        const openrouterApiKey = process.env.OPENROUTER_API_KEY
        if (!openrouterApiKey) {
          throw new Error("OPENROUTER_API_KEY environment variable is required for OpenRouter models")
        }
        return openrouter.chat(modelId)
      case "exa":
        console.log("Using Exa provider for:", modelId)
        const exaApiKey = process.env.EXA_API_KEY
        if (!exaApiKey) {
          throw new Error("EXA_API_KEY environment variable is required for Exa models")
        }
        return "exa" // Special handling in POST
      case "google":
        console.log("Using Google provider for:", modelId)
        return google(modelId)
      case "groq":
        console.log("Using Groq provider for:", modelId)
        return groq(modelId)
      case "cerebras":
        console.log("Using Cerebras provider for:", modelId)
        return cerebras(modelId)
      case "xai":
        console.log("Using xAI provider for:", modelId)
        return xai(modelId)
      default:
        console.warn(`Unknown provider ID: ${modelConfig.providerId} for model: ${modelId}`)
        break
    }
  }

  // Fallback logic for models not in configuration
  console.log("Model not found in configuration, using fallback logic for:", modelId)

  // OpenAI models
  if (modelId.startsWith("gpt-") || modelId.startsWith("o1-")) {
    console.log("Using OpenAI provider for:", modelId)
    return openai(modelId)
  }

  // Groq models (fallback)
  if (
    modelId.includes("llama") ||
    modelId.includes("mixtral") ||
    modelId.includes("gemma") ||
    modelId.includes("qwen") ||
    modelId.includes("deepseek") ||
    modelId.startsWith("groq-")
  ) {
    const cleanModel = modelId.replace("groq-", "")
    console.log("Using Groq provider (fallback) for:", cleanModel)
    return groq(cleanModel)
  }

  // Google/Gemini models (fallback)
  if (modelId.includes("gemini") || modelId.startsWith("google-")) {
    const cleanModel = modelId.replace("google-", "")
    console.log("Using Google provider (fallback) for:", cleanModel)
    return google(cleanModel)
  }

  // Cerebras models (fallback)
  if (modelId.includes("cerebras") || modelId.startsWith("cerebras-")) {
    const cleanModel = modelId.replace("cerebras-", "")
    console.log("Using Cerebras provider (fallback) for:", cleanModel)
    return cerebras(cleanModel)
  }

  // XAI models (fallback)
  if (modelId.includes("grok") || modelId.startsWith("xai-")) {
    const cleanModel = modelId.replace("xai-", "")
    console.log("Using XAI provider (fallback) for:", cleanModel)
    return xai(cleanModel)
  }

  // Default fallback to OpenAI
  console.warn(`Unknown model: ${modelId}, trying OpenAI as final fallback`)
  return openai(modelId)
}

export async function POST(req: Request) {
  try {
    const requestBody = await req.json()
    const { messages, chatId, selectedModel, attachments, activeChatFiles, warmup, ...otherOptions } = requestBody

    // Handle warmup requests
    if (warmup) {
      return new Response(JSON.stringify({ status: "warmed" }), { status: 200 })
    }

    const modelId = selectedModel

    if (!modelId || !messages) {
      return new Response(JSON.stringify({ error: "Missing modelId or messages" }), { status: 400 })
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages must be a non-empty array" }), { status: 400 })
    }

    console.log("Processing request for model:", modelId)
    console.log("Messages count:", messages.length)

    // Check if model is enabled
    const modelConfig = modelsData.models.find((model) => model.id === modelId)
    if (modelConfig && !modelConfig.enabled) {
      return new Response(JSON.stringify({ error: `Model ${modelId} is currently disabled` }), { status: 400 })
    }

    const processedMessages = messages

    // Handle attachments if present
    if (attachments && attachments.length > 0 && processedMessages.length > 0) {
      const lastMessageIndex = processedMessages.length - 1
      if (processedMessages[lastMessageIndex].role === "user") {
        console.log("Processing attachments for model:", modelId)
      }
    }

    const providerModel = getProviderModel(modelId)

    // Special handling for Exa
    if (providerModel === "exa") {
      const query = processedMessages[processedMessages.length - 1]?.content
      if (!query) {
        return new Response(JSON.stringify({ error: "No query provided for Exa search" }), { status: 400 })
      }
      const exaResult = await exa.answer(query, { text: true })
      return new Response(JSON.stringify({ answer: exaResult.answer, citations: exaResult.citations }), { status: 200 })
    }

    const streamTextOptions: any = {
      model: providerModel,
      messages: processedMessages,
    }

    // Add optional parameters
    if (otherOptions.temperature !== undefined) {
      streamTextOptions.temperature = otherOptions.temperature
    }
    if (otherOptions.maxTokens !== undefined) {
      streamTextOptions.maxTokens = otherOptions.maxTokens
    }
    if (otherOptions.system !== undefined) {
      streamTextOptions.system = otherOptions.system
    }

    console.log("Streaming with model:", modelId)

    const result = streamText(streamTextOptions)

    return result.toDataStreamResponse({
      getErrorMessage: (error) => {
        console.error("AI API Error:", error)
        if (!error) return "Unknown error occurred"
        if (typeof error === "string") return error
        if (error instanceof Error) return error.message
        return JSON.stringify(error)
      },
    })
  } catch (error) {
    console.error("AI API Route Error:", error)

    // Handle specific API key errors
    if (error instanceof Error) {
      if (error.message.includes("OPENROUTER_API_KEY")) {
        return new Response(
          JSON.stringify({
            error: "OpenRouter API key not configured. Please add OPENROUTER_API_KEY to your environment variables.",
          }),
          { status: 500 },
        )
      }
      if (error.message.includes("EXA_API_KEY")) {
        return new Response(
          JSON.stringify({
            error: "Exa API key not configured. Please add EXA_API_KEY to your environment variables.",
          }),
          { status: 500 },
        )
      }
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        issues: (typeof error === "object" && error && "issues" in error) ? (error as any).issues : undefined,
      }),
      { status: 500 },
    )
  }
}
