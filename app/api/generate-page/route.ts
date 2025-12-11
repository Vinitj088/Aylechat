import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

export const runtime = "edge"

const cerebras = createOpenAI({
  apiKey: process.env.CEREBRAS_API_KEY,
  baseURL: "https://api.cerebras.ai/v1",
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { topic, sectionTitle, prompt: userPrompt, generateSingleSection } = body

    if (!topic) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Single section generation with user prompt
    if (generateSingleSection) {
      if (!userPrompt) {
        return new Response(JSON.stringify({ error: "Prompt is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }

      const prompt = `You are an expert content writer helping create a page about "${topic}".

Write content for the section titled "${sectionTitle || "Section"}".

User's instructions: ${userPrompt}

Requirements:
- Write 2-4 paragraphs of high-quality, well-researched content
- Use a professional, informative tone
- Include specific facts, examples, or insights where relevant
- Make the content engaging and easy to read
- Follow the user's instructions carefully

Write only the content text directly, no JSON formatting, no section titles, no markdown headers. Just the plain text content with paragraph breaks.`

      const result = await generateText({
        model: cerebras("llama-3.3-70b"),
        prompt,
        maxTokens: 2000,
      })

      return new Response(result.text, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      })
    }

    return new Response(JSON.stringify({ error: "Full page generation not supported" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Error generating page content:", error)
    return new Response(JSON.stringify({ error: "Failed to generate content" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
