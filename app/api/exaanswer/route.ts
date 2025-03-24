// app/api/exaanswer/route.ts
import { NextRequest } from 'next/server';
import Exa from "exa-js";
import { Message } from '@/app/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const exa = new Exa(process.env.EXA_API_KEY as string);

export async function POST(req: NextRequest) {
  try {
    // Parse request body first
    const body = await req.json();
    const { query, messages } = body;
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
    }

    // Add timeout promise to avoid hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Exa API request timed out')), 20000); // 20 seconds timeout
    });

    // Format previous messages for context if they exist
    let enhancedQuery = query;
    if (messages && messages.length > 0) {
      // Convert messages to a conversation context string
      const conversationContext = messages
        .map((msg: Message) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');
      
      // Enhance the query with conversation context
      enhancedQuery = `Based on this conversation:\n\n${conversationContext}\n\nAnswer this follow-up question: ${query}`;
    }

    // Create Exa stream - using the enhanced query with context when available
    const streamPromise = exa.streamAnswer(enhancedQuery, { 
      model: "exa-pro"
    });
    
    // Use Promise.race to implement timeout
    const stream = await Promise.race([streamPromise, timeoutPromise]) as AsyncIterable<{
      content: string;
      citations?: Array<{
        url: string;
        title?: string;
        snippet?: string;
        favicon?: string;
        id?: string;
      }>;
    }>;
    
    const encoder = new TextEncoder();

    const streamResponse = new ReadableStream({
      async start(controller) {
        try {
          // Add a timeout for the entire streaming process
          const streamTimeout = setTimeout(() => {
            controller.error(new Error('Streaming response timed out'));
          }, 20000); // 20 seconds timeout
          
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
          
          clearTimeout(streamTimeout);
          controller.close();
        } catch (error) {
          console.error('Error during stream processing:', error);
          
          // Send a partial response error message so the frontend knows something went wrong
          controller.enqueue(encoder.encode(JSON.stringify({
            choices: [{ delta: { content: "\n\nI apologize, but I encountered an issue completing this search. Please try rephrasing your question or breaking it into smaller parts." } }]
          }) + '\n'));
          
          controller.close();
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Exa API error:', error);
    return new Response(
      JSON.stringify({ 
        error: `Failed to perform search | ${errorMessage}`,
        message: "There was an issue with your search request. Please try rephrasing your query."
      }), 
      { status: 500 }
    );
  }
}