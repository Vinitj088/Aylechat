import { Message } from '../../types';
import { availableTools } from '../../tools';

// --- Tool Analysis Service with Caching ---

export type ToolResult = {
  command: string;
  query: string;
  text: string;
} | null;

// Simple LRU cache for tool analysis results
const toolAnalysisCache = new Map<
  string,
  { result: ToolResult; timestamp: number }
>();
const TOOL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
const TOOL_CACHE_MAX_SIZE = 100;

/**
 * Clean up old cache entries
 */
const cleanToolCache = () => {
  const now = Date.now();
  const entries = Array.from(toolAnalysisCache.entries());

  // Remove expired entries
  for (const [key, value] of entries) {
    if (now - value.timestamp > TOOL_CACHE_TTL) {
      toolAnalysisCache.delete(key);
    }
  }

  // Remove oldest entries if cache is too large
  if (toolAnalysisCache.size > TOOL_CACHE_MAX_SIZE) {
    const sortedEntries = entries.sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    const toRemove = sortedEntries.slice(
      0,
      toolAnalysisCache.size - TOOL_CACHE_MAX_SIZE
    );
    toRemove.forEach(([key]) => toolAnalysisCache.delete(key));
  }
};

/**
 * Analyzes a query to determine if a tool should be used
 * Uses LLM to detect tool requirements and caches results
 * @param query - User query to analyze
 * @param messages - Conversation history for context
 * @returns Tool information or null if no tool needed
 */
export async function analyzeQueryForTools(
  query: string,
  messages: Message[]
): Promise<ToolResult> {
  // Create cache key based on query and last message context
  const lastMessage = messages[messages.length - 1];
  const cacheKey = `${query.toLowerCase().trim()}-${lastMessage?.id || 'none'}`;

  // Check cache first
  const cached = toolAnalysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TOOL_CACHE_TTL) {
    console.log('Tool analysis cache HIT for:', query);
    return cached.result;
  }

  const model = 'llama-3.1-8b-instant'; // A fast model is good for this
  const toolsString = availableTools
    .map((t) => `- ${t.command} - ${t.description}`)
    .join('\n');

  // Format previous messages to provide context
  const history = messages
    .slice(-3)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const systemPrompt = `You are an expert AI assistant that analyzes a user's query and conversation history to determine if the query can be better answered using one of the available tools. Your primary goal is to distinguish between requests for **real-time, specific data** (which tools can provide) and **general knowledge questions** (which you should answer directly).

Your task is to respond with a JSON object. The JSON object should have one of two formats:
1. If a tool is applicable for real-time data: {"tool": "/command_name", "query": "argument for the command", "text": "Short phrase for a button, e.g., 'Get Weather'"}
2. If no tool is applicable (i.e., it's a general knowledge question): {"tool": null}

Available Tools:
${toolsString}

Conversation History (for context):
---
${history}
---

Rules:
- **Crucial Rule**: Use the conversation history to resolve pronouns or ambiguous references (e.g., "there," "that movie").
- **CRITICAL**: You MUST only use a tool command from the "Available Tools" list. If no tool in the list is appropriate, you MUST respond with {"tool": null}. Do NOT invent a tool.
- Only use a tool if the user is asking for specific, current information. For example, use the weather tool for "what is the weather *right now* in Paris?", but NOT for "is Paris *usually* cold in winter?". The latter is a general knowledge question.
- ONLY respond with the JSON object. Do not include any other text, explanations, or markdown.
- If the user's question is general, conceptual, historical, or a statement to be verified, respond with {"tool": null}.

Examples:
User Query: "what is the weather like in london?"
Response: {"tool": "/weather", "query": "london", "text": "Get Weather for London"}

User Query (after a conversation about Paris): "what about there?"
Response: {"tool": "/weather", "query": "paris", "text": "Get Weather for Paris"}

User Query: "weather all around the year in paris is snowy, isnt it?"
Response: {"tool": null}
`;

  try {
    const response = await fetch('/api/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        model: model,
        systemPrompt: systemPrompt,
        stream: false, // We need a single JSON response, not a stream
        temperature: 0.0,
      }),
    });

    if (!response.ok) {
      console.error('Tool analysis API call failed:', response.status);
      return null;
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      console.error('Tool analysis returned no content.');
      return null;
    }

    // Extract the JSON object from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Tool analysis response was not valid JSON:', content);
      return null;
    }

    const toolJson = JSON.parse(jsonMatch[0]);

    let toolResult: ToolResult = null;

    if (toolJson.tool && toolJson.query && toolJson.text) {
      // Validate that the tool is one of the available tools
      const isToolValid = availableTools.some((t) => t.command === toolJson.tool);
      if (isToolValid) {
        console.log('Tool suggestion analysis result:', toolJson);
        toolResult = {
          command: toolJson.tool,
          query: toolJson.query,
          text: toolJson.text,
        };
      } else {
        console.warn(
          `Model suggested an unavailable tool: '${toolJson.tool}'. Ignoring suggestion.`
        );
      }
    }

    // Cache the result
    toolAnalysisCache.set(cacheKey, {
      result: toolResult,
      timestamp: Date.now(),
    });
    cleanToolCache(); // Clean up old entries

    return toolResult;
  } catch (error) {
    console.error('Error during tool analysis:', error);
    // Cache null result to prevent repeated failed attempts
    toolAnalysisCache.set(cacheKey, {
      result: null,
      timestamp: Date.now(),
    });
    return null;
  }
}
