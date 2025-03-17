// app/api/exaanswer/route.ts
import { NextRequest } from 'next/server';
import Exa from "exa-js";
import { authService } from '@/lib/auth-service';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const exa = new Exa(process.env.EXA_API_KEY as string);

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated
    const user = await authService.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { query } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
    }

    const stream = exa.streamAnswer(query, { model: "exa-pro" });
    
    const encoder = new TextEncoder();

    const streamResponse = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // Send citations if present
            if (chunk.citations?.length) {
              controller.enqueue(encoder.encode(JSON.stringify({ citations: chunk.citations }) + '\n'));
            }

            // Send content
            controller.enqueue(encoder.encode(JSON.stringify({
              choices: [{ delta: { content: chunk.content } }]
            }) + '\n'));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(streamResponse, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: `Failed to perform search | ${error.message}` }), 
      { status: 500 }
    );
  }
}