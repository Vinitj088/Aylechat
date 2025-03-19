// app/api/exaanswer/route.ts
import { NextRequest } from 'next/server';
import Exa from "exa-js";
import { Message } from '@/app/types';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const exa = new Exa(process.env.EXA_API_KEY as string);

export async function POST(req: NextRequest) {
  try {
    console.log('API: Exa - retrieving auth session');
    
    // Create the Supabase client with cookie handling
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    
    // Check session first
    if (session?.user) {
      console.log('API: Exa - User authenticated from session:', session.user.email);
    } else {
      // Try header auth as fallback
      const headerUserId = req.headers.get('x-auth-user-id');
      const headerEmail = req.headers.get('x-auth-email');
      
      if (!headerUserId) {
        console.log('API: Exa - No valid authentication found');
        return new Response(JSON.stringify({ error: 'Unauthorized', details: 'No session found' }), { status: 401 });
      }
      
      console.log(`API: Exa - Using header auth: ${headerEmail || headerUserId}`);
    }

    const { query, messages } = await req.json();
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
    }

    console.log(`API: Exa - Processing search for query: ${query}`);

    // Add timeout promise to avoid hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Exa API request timed out')), 45000); // 45 seconds timeout
    });

    // Create Exa stream with the query
    console.log('API: Exa - Calling API with query:', query);
    const streamPromise = exa.streamAnswer(query, { 
      model: "exa-pro"
    });
    
    // Use Promise.race to implement timeout
    const stream = await Promise.race([streamPromise, timeoutPromise]) as AsyncIterable<any>;
    console.log('API: Exa - Stream created successfully');
    
    const encoder = new TextEncoder();

    const streamResponse = new ReadableStream({
      async start(controller) {
        try {
          // Add a timeout for the entire streaming process
          const streamTimeout = setTimeout(() => {
            controller.error(new Error('Streaming response timed out'));
          }, 45000); // 45 seconds timeout
          
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
          console.error('API: Exa - Error during stream processing:', error);
          
          // Send a partial response error message
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
  } catch (error: any) {
    console.error('API: Exa - Critical error:', error);
    return new Response(
      JSON.stringify({ 
        error: `Failed to perform search | ${error.message}`,
        message: "There was an issue with your search request. Please try rephrasing your query."
      }), 
      { status: 500 }
    );
  }
}