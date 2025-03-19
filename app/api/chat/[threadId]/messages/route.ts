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
    console.log('API: Messages GET - retrieving auth session');
    
    // Create the Supabase client with cookie handling
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    
    let userId = session?.user?.id;
    
    // If no session, try header auth
    if (!userId) {
      const headerUserId = request.headers.get('x-auth-user-id');
      if (headerUserId) {
        console.log('API: Messages GET - Using header auth:', headerUserId);
        userId = headerUserId;
      } else {
        console.error('API: Messages GET - No valid authentication found');
        return NextResponse.json(
          { success: false, error: 'Unauthorized: No session found' },
          { status: 401, headers: CACHE_HEADERS }
        );
      }
    } else {
      console.log('API: Messages GET - User authenticated from session:', session?.user?.email || 'unknown');
    }

    // Verify thread ownership
    console.log(`API: Messages GET - Retrieving thread ${threadId} for user ${userId}`);
    const thread = await RedisService.getChatThread(userId, threadId);
    if (!thread) {
      return NextResponse.json(
        { success: false, error: 'Thread not found or not owned by user' },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    // Get messages from the thread
    const messages = thread.messages || [];
    console.log(`API: Messages GET - Retrieved ${messages.length} messages`);

    return NextResponse.json(
      { success: true, messages },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('API: Messages GET error:', error);
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
    console.log('API: Messages POST - retrieving auth session');
    
    // Create the Supabase client with cookie handling
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    
    let userId = session?.user?.id;
    
    // If no session, try header auth
    if (!userId) {
      const headerUserId = request.headers.get('x-auth-user-id');
      if (headerUserId) {
        console.log('API: Messages POST - Using header auth:', headerUserId);
        userId = headerUserId;
      } else {
        console.error('API: Messages POST - No valid authentication found');
        return NextResponse.json(
          { success: false, error: 'Unauthorized: No session found' },
          { status: 401, headers: CACHE_HEADERS }
        );
      }
    } else {
      console.log('API: Messages POST - User authenticated from session:', session?.user?.email || 'unknown');
    }

    // Verify thread ownership
    console.log(`API: Messages POST - Verifying thread ${threadId} for user ${userId}`);
    const thread = await RedisService.getChatThread(userId, threadId);
    if (!thread) {
      return NextResponse.json(
        { success: false, error: 'Thread not found or not owned by user' },
        { status: 404, headers: CACHE_HEADERS }
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
    
    console.log(`API: Messages POST - Added message to thread ${threadId}`);

    return NextResponse.json(
      { success: true, message: userMessage },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('API: Messages POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add chat message' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
} 