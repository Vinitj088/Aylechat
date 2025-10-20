// Shared Groq client utility for server-side use

const API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export interface GroqRequest {
  query: string;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
}

/**
 * Call Groq API directly from server-side code
 * This is a utility function to avoid relative fetch URLs in API routes
 */
export async function callGroqAPI({
  query,
  model,
  systemPrompt,
  temperature = 0.5,
  maxTokens = 4000,
  stream = false,
}: GroqRequest): Promise<GroqResponse | null> {
  const API_KEY = process.env.GROQ_API_KEY;

  if (!API_KEY) {
    console.error('GROQ_API_KEY environment variable not set');
    return null;
  }

  try {
    const formattedMessages = [];

    // Add system prompt if provided
    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }

    // Add user message
    formattedMessages.push({ role: 'user', content: query });

    const params = {
      messages: formattedMessages,
      model,
      temperature,
      max_tokens: maxTokens,
      stream,
      top_p: 1,
    };

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Groq API error:', error);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error calling Groq API:', error);
    return null;
  }
}
