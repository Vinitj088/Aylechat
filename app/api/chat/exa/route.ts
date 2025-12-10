import Exa from 'exa-js';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface ExaChunk {
  content: string;
  citations?: Array<{
    url: string;
    title?: string;
    snippet?: string;
    favicon?: string;
    id?: string;
  }>;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the last user message as the query
    const lastUserMessage = [...messages].reverse().find((m: Message) => m.role === 'user');
    const query = lastUserMessage?.content || '';

    if (!query) {
      return new Response(JSON.stringify({ error: 'No user message found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Initialize Exa client
    const exa = new Exa(process.env.EXA_API_KEY as string);

    // Build enhanced query with conversation context
    let enhancedQuery = query;
    if (messages.length > 1) {
      const recentMessages = messages.slice(-3);
      const conversationContext = recentMessages
        .map((msg: Message) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');
      enhancedQuery = `Based on this conversation:\n\n${conversationContext}\n\nAnswer this follow-up question: ${query}`;
    }

    // Create Exa stream with timeout
    const streamPromise = exa.streamAnswer(enhancedQuery, {
      model: 'exa-pro',
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Exa API request timed out')), 55000);
    });

    const stream = await Promise.race([streamPromise, timeoutPromise]) as AsyncIterable<ExaChunk>;

    const encoder = new TextEncoder();

    // Create a ReadableStream that formats data for AI SDK data stream protocol
    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          let citationsSent = false;
          let fullContent = '';

          for await (const chunk of stream) {
            // Send citations as data annotation (only once)
            if (chunk.citations?.length && !citationsSent) {
              // AI SDK data stream format: 2:JSON\n for data
              const citationData = JSON.stringify([{
                type: 'citations',
                citations: chunk.citations,
              }]);
              controller.enqueue(encoder.encode(`2:${citationData}\n`));
              citationsSent = true;
            }

            // Send content as text delta
            if (chunk.content) {
              fullContent += chunk.content;
              // AI SDK data stream format: 0:"text"\n for text delta
              const textData = JSON.stringify(chunk.content);
              controller.enqueue(encoder.encode(`0:${textData}\n`));
            }
          }

          // Send finish message
          // Format: d:{finishReason:"stop"}\n
          controller.enqueue(encoder.encode(`d:${JSON.stringify({ finishReason: 'stop' })}\n`));
          controller.close();
        } catch (error) {
          console.error('Error during Exa stream:', error);
          // Send error as text
          const errorText = JSON.stringify('\n\nI apologize, but I encountered an issue completing this search. Please try rephrasing your question.');
          controller.enqueue(encoder.encode(`0:${errorText}\n`));
          controller.enqueue(encoder.encode(`d:${JSON.stringify({ finishReason: 'error' })}\n`));
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1',
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Exa API error:', error);
    return new Response(
      JSON.stringify({
        error: `Failed to perform search | ${errorMessage}`,
        message: 'There was an issue with your search request. Please try rephrasing your query.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
