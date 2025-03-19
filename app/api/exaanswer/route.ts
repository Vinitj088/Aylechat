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
  console.log('Exa API called');
  try {
    // Get authenticated user using Supabase's route handler
    console.log('Getting authenticated user with createRouteHandlerClient...');
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    let isAuthenticated = false;
    let userEmail = null;
    
    // Regular Supabase auth check
    if (session?.user) {
      console.log('User authenticated from session:', session.user.email);
      isAuthenticated = true;
      userEmail = session.user.email;
    } 
    // Fallback to cookies if no session
    else {
      console.log('No session, trying backup cookies...');
      const cookieStore = cookies();
      const userAuthCookie = cookieStore.get('user-authenticated');
      const userEmailCookie = cookieStore.get('user-email');
      
      if (userAuthCookie && userEmailCookie?.value) {
        console.log('Found backup authentication cookies for:', userEmailCookie.value);
        isAuthenticated = true;
        userEmail = userEmailCookie.value;
      }
    }
    
    if (!isAuthenticated) {
      console.error('No valid authentication found');
      return new Response(JSON.stringify({ error: 'Unauthorized', details: 'No valid authentication found' }), { status: 401 });
    }

    console.log('User authenticated:', userEmail);
    const { query, messages } = await req.json();
    console.log('Request body:', { query, messageCount: messages?.length });
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
    }

    // Extract the actual query - no need to include all conversation history
    // since Exa is a search API, not an LLM with a context window
    console.log(`Processing Exa search for query: ${query}`);

    // Add timeout promise to avoid hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Exa API request timed out')), 45000); // 45 seconds timeout
    });

    // Create Exa stream - just pass the raw query since Exa is a search API
    // Using the options according to exa-js documentation
    console.log('Calling Exa API with query:', query);
    const streamPromise = exa.streamAnswer(query, { 
      model: "exa-pro"
    });
    
    // Use Promise.race to implement timeout
    const stream = await Promise.race([streamPromise, timeoutPromise]) as AsyncIterable<any>;
    console.log('Exa stream created, now streaming response...');
    
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
  } catch (error: any) {
    console.error('Exa API error:', error);
    return new Response(
      JSON.stringify({ 
        error: `Failed to perform search | ${error.message}`,
        message: "There was an issue with your search request. Please try rephrasing your query."
      }), 
      { status: 500 }
    );
  }
}