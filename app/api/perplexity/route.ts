// app/api/sonar/route.ts

import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic'; // Always dynamic for edge deployments
export const maxDuration = 60; // Vercel Hobby limit

const API_URL = 'https://api.perplexity.ai/chat/completions';
const encoder = new TextEncoder();

const handleWarmup = () => {
  return new Response(
    JSON.stringify({ status: 'warmed_up' }),
    { status: 200 }
  );
};

// Build a stream transformer for handling SSE streaming from Perplexity
const createStreamTransformer = () => {
  let buffer = '';
  let citations: any[] = [];
  let hasFinished = false;
  return new TransformStream({
    transform(chunk, controller) {
      buffer += new TextDecoder().decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          processLineToController(line, controller, citations, hasFinished);
          // Check if this is the final chunk
          if (line.includes('"finish_reason"') || line.includes('"done":true')) {
            hasFinished = true;
            // Send citations at the end
            if (citations.length > 0) {
              controller.enqueue(encoder.encode(JSON.stringify({ citations }) + '\n'));
            }
          }
        } catch (error) {
          // Log error for debugging but continue processing
          console.error('Error processing line:', error, 'Line:', line);
        }
      }
    },
    flush(controller) {
      if (buffer.trim()) {
        try {
          processLineToController(buffer, controller, citations, hasFinished);
        } catch (error) {
          console.error('Error processing final buffer:', error, 'Buffer:', buffer);
        }
      }
      // Send citations if not already sent
      if (!hasFinished && citations.length > 0) {
        controller.enqueue(encoder.encode(JSON.stringify({ citations }) + '\n'));
      }
    }
  });
};

function processLineToController(line: string, controller: TransformStreamDefaultController, citations: any[], hasFinished: boolean) {
  if (!line.startsWith('data: ')) return;
  const data = line.slice(6);
  if (data === '[DONE]') return;
  try {
    const json = JSON.parse(data);
    
    // Collect citations but don't send them yet
    if (!hasFinished && json.search_results && Array.isArray(json.search_results)) {
      const newCitations = json.search_results.map((result: any, index: number) => ({
        id: `citation-${index}`,
        url: result.url,
        title: result.title || result.url,
        favicon: result.favicon || null
      }));
      
      // Only add citations if we don't already have them
      if (citations.length === 0) {
        citations.push(...newCitations);
      }
    }
    
    // Only extract from delta.content, not message.content to avoid duplication
    const delta = json.choices?.[0]?.delta?.content;
    if (delta && typeof delta === 'string' && delta.trim()) {
      const message = { choices: [{ delta: { content: delta } }] };
      controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));
    }
  } catch (error) {
    // Log parse errors for debugging
    console.error('Error parsing JSON:', error, 'Data:', data);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();

    // Fast path for warmup
    if (body.warmup === true) return handleWarmup();

    const { query, model, messages, systemPrompt, enhance, ...extra } = body;

    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
    }

    if (!model) {
      return new Response(JSON.stringify({ error: 'model is required' }), { status: 400 });
    }

    // Prepare message array (system prompt + user messages)
    const formattedMessages: any[] = [];
    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }
    formattedMessages.push({ role: 'user', content: query });

    // Build Perplexity API request
    const params = {
      model,
      messages: formattedMessages,
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: enhance ? 1000 : 4000,
      stream: true,
      ...extra, // pass additional custom params if present
    };

    const API_KEY = process.env.PPLX_API_KEY;
    if (!API_KEY) throw new Error('PPLX_API_KEY environment variable not set');

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(params),
      cache: 'no-store'
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Perplexity Sonar API error: ${error.error?.message || response.statusText}`);
    }

    // Stream response through our transformer for chunked streaming
    const transformer = createStreamTransformer();
    return new Response(response.body?.pipeThrough(transformer), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive'
      }
    });

  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: 'Failed to process request: ' + (error?.message || error),
        message: "I couldn't complete your request. Please try again."
      }),
      { status: 500 }
    );
  }
}
