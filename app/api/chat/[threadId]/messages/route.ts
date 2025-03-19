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
    
    let userId = null;
    
    // Handle normal authentication
    if (session?.user) {
      console.log('User authenticated from session:', session.user.email);
      userId = session.user.id;
    } else {
      // Fallback to custom cookies if session not found
      const cookieStore = cookies();
      const userAuthCookie = cookieStore.get('user-authenticated');
      const userEmailCookie = cookieStore.get('user-email');
      
      // If we have our custom cookies, try to use them
      if (userAuthCookie && userEmailCookie && userEmailCookie.value) {
        console.log('Attempting to use backup cookies for:', userEmailCookie.value);
        
        // Create a mock user ID based on email (temporary solution)
        const mockUserId = userEmailCookie.value.split('@')[0] + '-user';
        console.log('Using mock user ID for authentication:', mockUserId);
        userId = mockUserId;
      }
    }
    
    // If still no user ID, return unauthorized
    if (!userId) {
      if (authError) {
        console.error('Authentication error:', authError);
      }
      console.error('No valid user authentication found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No valid authentication found' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

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
    
    let userId = null;
    
    // Handle normal authentication
    if (session?.user) {
      console.log('User authenticated from session:', session.user.email);
      userId = session.user.id;
    } else {
      // Fallback to custom cookies if session not found
      const cookieStore = cookies();
      const userAuthCookie = cookieStore.get('user-authenticated');
      const userEmailCookie = cookieStore.get('user-email');
      
      // If we have our custom cookies, try to use them
      if (userAuthCookie && userEmailCookie && userEmailCookie.value) {
        console.log('Attempting to use backup cookies for:', userEmailCookie.value);
        
        // Create a mock user ID based on email (temporary solution)
        const mockUserId = userEmailCookie.value.split('@')[0] + '-user';
        console.log('Using mock user ID for authentication:', mockUserId);
        userId = mockUserId;
      }
    }
    
    // If still no user ID, return unauthorized
    if (!userId) {
      if (authError) {
        console.error('Authentication error:', authError);
      }
      console.error('No valid user authentication found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No valid authentication found' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

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