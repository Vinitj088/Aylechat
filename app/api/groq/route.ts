import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Groq from 'groq-sdk';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY as string,
});

export async function POST(req: NextRequest) {
  try {
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
        // Accept the cookie auth as valid without database checks
        isAuthenticated = true;
        userEmail = userEmailCookie.value;
      }
    }
    
    if (!isAuthenticated) {
      console.error('No valid authentication found');
      return new Response(JSON.stringify({ error: 'Unauthorized', details: 'No valid authentication found' }), { status: 401 });
    }

    console.log('User authenticated:', userEmail);
    const { messages, model = 'llama3-70b-8192' } = await req.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages array is required' }), { status: 400 });
    }

    // Make the formatted messages for Groq API compatible
    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant' as const,
      content: msg.content
    })) as Array<{ role: 'user' | 'assistant'; content: string }>;

    console.log(`Creating Groq chat with model "${model}" and ${formattedMessages.length} messages`);
    
    // Start the chat completion stream
    const completion = await groq.chat.completions.create({
      messages: formattedMessages,
      model: model,
      temperature: 0.5,
      max_tokens: 4000,
      stream: true,
    });

    // Create a readable stream to pipe the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(JSON.stringify({
                choices: [{ delta: { content } }]
              }) + '\n'));
            }
          }
          controller.close();
        } catch (error) {
          console.error('Error streaming from Groq:', error);
          controller.enqueue(encoder.encode(JSON.stringify({
            choices: [{ 
              delta: { 
                content: '\n\nI apologize, but I encountered an error while generating a response. Please try again or rephrase your question.' 
              } 
            }]
          }) + '\n'));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Groq API error:', error);
    return new Response(
      JSON.stringify({ 
        error: `Failed to generate response | ${error.message}`,
        message: "There was an issue processing your request. Please try again later."
      }), 
      { status: 500 }
    );
  }
} 