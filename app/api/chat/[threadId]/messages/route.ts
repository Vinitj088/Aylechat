import { NextRequest, NextResponse } from 'next/server';
import { RedisService, Message } from '@/lib/redis';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';

// No-cache headers
const CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache'
};

export async function GET(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const { threadId } = params;

    // Get authenticated user using Supabase's route handler
    console.log('Getting authenticated user with createRouteHandlerClient...');
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error('Authentication error:', authError);
      return NextResponse.json(
        { success: false, error: 'Authentication error: ' + authError.message },
        { status: 401, headers: CACHE_HEADERS }
      );
    }
    
    if (!session || !session.user) {
      console.error('No session or user found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No session found' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    console.log('User authenticated:', session.user.email);
    const userId = session.user.id;

    // Verify thread ownership
    const thread = await RedisService.getChatThread(userId, threadId);
    if (!thread) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Thread not found or not owned by user' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    // Get messages from the thread
    const messages = thread.messages || [];

    return NextResponse.json(
      { success: true, messages },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Error getting chat messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get chat messages' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const { threadId } = params;
    
    // Get authenticated user using Supabase's route handler
    console.log('Getting authenticated user with createRouteHandlerClient...');
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error('Authentication error:', authError);
      return NextResponse.json(
        { success: false, error: 'Authentication error: ' + authError.message },
        { status: 401, headers: CACHE_HEADERS }
      );
    }
    
    if (!session || !session.user) {
      console.error('No session or user found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No session found' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    console.log('User authenticated:', session.user.email);
    const userId = session.user.id;

    // Verify thread ownership
    const thread = await RedisService.getChatThread(userId, threadId);
    if (!thread) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Thread not found or not owned by user' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    const body = await request.json();
    const { message, model } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message is required and must be a string' },
        { status: 400, headers: CACHE_HEADERS }
      );
    }

    // Add user message to thread
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: message,
      role: 'user'
    };

    // Update the thread with the new message
    const updatedMessages = [...(thread.messages || []), userMessage];
    await RedisService.updateChatThread(userId, threadId, {
      messages: updatedMessages,
    });

    return NextResponse.json(
      { success: true, message: userMessage },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Error adding chat message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add chat message' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
} 