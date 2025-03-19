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
    // Get authenticated user using Supabase's route handler
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: 'No session found' }), { status: 401 });
    }

    console.log('User authenticated:', session.user.email);
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