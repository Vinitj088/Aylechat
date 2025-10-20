import { Message } from '../../types';

// --- Context Window Management ---

// Character limits for context windows
export const MODEL_LIMITS = {
  exa: 4000, // Reduced limit for Exa to prevent timeouts
  groq: 128000, // Groq models have a much larger limit
  google: 64000, // Google Gemini models
  default: 8000, // Fallback limit
};

// Phase 4: Define K for buffer memory (number of message PAIRS)
const K_MESSAGE_PAIRS = 5; // Retain last 5 user/assistant pairs (10 messages total)

/**
 * Truncates conversation history to fit within context window
 * Uses K-window buffer memory strategy
 * @param messages - Full message history
 * @param modelId - Model identifier for context limit
 * @returns Truncated message array
 */
export const truncateConversationHistory = (
  messages: Message[],
  modelId: string
): Message[] => {
  // For Exa, include limited context (last few messages) to support follow-up questions
  if (modelId === 'exa') {
    // Get the last 3 messages (or fewer if there aren't that many)
    // This provides enough context for follow-ups without being too much
    const recentMessages = [...messages].slice(-3);

    // Make sure the last message is always included (should be a user message)
    if (
      recentMessages.length > 0 &&
      recentMessages[recentMessages.length - 1].role !== 'user'
    ) {
      // If the last message isn't from the user, find the last user message
      const userMessages = messages.filter((msg) => msg.role === 'user');
      if (userMessages.length > 0) {
        // Replace the last message with the most recent user message
        recentMessages[recentMessages.length - 1] =
          userMessages[userMessages.length - 1];
      }
    }

    return recentMessages;
  }

  // Phase 4: K-Window Buffer Memory for LLMs (Groq, Gemini, etc.)
  const maxMessages = K_MESSAGE_PAIRS * 2;

  // If the total number of messages is already within the limit, return them all
  if (messages.length <= maxMessages) {
    return messages;
  }

  // Otherwise, return only the last `maxMessages` messages
  console.log(
    `Truncating history from ${messages.length} to ${maxMessages} messages (K=${K_MESSAGE_PAIRS}).`
  );
  return messages.slice(-maxMessages);
};

// --- Dynamic System Prompts for Token Optimization ---

export const SYSTEM_PROMPTS = {
  // Minimal prompt for casual/short queries (saves ~150 tokens)
  casual: `You are a helpful AI assistant. Provide clear, concise answers using proper Markdown formatting.`,

  // Code-focused prompt for programming queries (saves ~50 tokens, more targeted)
  code: `You are an expert coding assistant. Provide clear, well-formatted code with explanations using Markdown:
- Use code blocks with language specified
- Include comments in code
- Explain your approach
- Suggest best practices`,

  // Full detailed prompt for complex queries (original)
  detailed: `You are an expert AI coding assistant. Your responses must be clear, concise, and highly informative. When providing answers, always use high-quality Markdown with proper tags and formatting, including:

- Headings (#, ##, etc.) for structure
- Lists (ordered/unordered) for steps or options
- Code blocks (with language specified) for all code, commands, or config
- Tables for comparisons or structured data
- Blockquotes for highlighting important notes or warnings
- Bold/italic for emphasis where appropriate

Instructions:
- Always use semantic Markdown structure for readability.
- Ensure all code is properly formatted and syntax-highlighted.
- Provide explanations and context for your answers.
- Include examples where helpful.
- Suggest best practices and modern conventions.
- Point out potential improvements or alternatives if relevant.
- Avoid unnecessary verbosity or filler.
- For long answers, provide a brief summary or TL;DR at the end.

If the user's question is ambiguous, ask clarifying questions before answering.`,
};

/**
 * Selects appropriate system prompt based on query complexity
 * Reduces token usage for simple queries
 * @param query - User query to analyze
 * @returns Appropriate system prompt string
 */
export const selectSystemPrompt = (query: string): string => {
  const lowerQuery = query.toLowerCase();

  // Check for code-related keywords
  const codeKeywords = [
    'code',
    'function',
    'class',
    'debug',
    'error',
    'implement',
    'script',
    'program',
    'api',
    'algorithm',
    'syntax',
    'variable',
    'const',
    'let',
    'import',
    'export',
  ];
  const hasCodeKeywords = codeKeywords.some((keyword) =>
    lowerQuery.includes(keyword)
  );

  if (hasCodeKeywords) {
    return SYSTEM_PROMPTS.code;
  }

  // Use casual prompt for short queries (< 50 characters or < 8 words)
  const wordCount = query.trim().split(/\s+/).length;
  if (query.length < 50 || wordCount < 8) {
    return SYSTEM_PROMPTS.casual;
  }

  // Default to detailed prompt for complex queries
  return SYSTEM_PROMPTS.detailed;
};

// Keep original prompt for backward compatibility
export const ASSISTANT_SYSTEM_PROMPT = SYSTEM_PROMPTS.detailed;
