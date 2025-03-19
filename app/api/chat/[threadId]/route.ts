import { NextRequest, NextResponse } from 'next/server';
import { RedisService } from '@/lib/redis';
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
    console.log('API: Thread GET - retrieving auth session');
    
    // Create the Supabase client with cookie handling
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    
    let userId = session?.user?.id;
    
    // If no session, try header auth
    if (!userId) {
      const headerUserId = request.headers.get('x-auth-user-id');
      if (headerUserId) {
        console.log('API: Thread GET - Using header auth:', headerUserId);
        userId = headerUserId;
      } else {
        console.log('API: Thread GET - No valid authentication found');
        return NextResponse.json(
          { success: false, error: 'Unauthorized: No session found' },
          { status: 401, headers: CACHE_HEADERS }
        );
      }
    } else {
      console.log('API: Thread GET - User authenticated from session:', session?.user?.email || 'unknown');
    }

    // Get thread
    console.log(`API: Thread GET - Retrieving thread ${threadId} for user ${userId}`);
    const thread = await RedisService.getChatThread(userId, threadId);
    if (!thread) {
      return NextResponse.json(
        { success: false, error: 'Thread not found' },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, thread },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('API: Thread GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get thread' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const { threadId } = params;
    
    // Get authenticated user using Supabase's route handler
    console.log('Getting authenticated user with createRouteHandlerClient...');
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No session found' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    const userId = session.user.id;
    console.log('User authenticated:', session.user.email);

    // Verify thread exists and is owned by user
    const existingThread = await RedisService.getChatThread(userId, threadId);
    if (!existingThread) {
      return NextResponse.json(
        { success: false, error: 'Thread not found' },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    const body = await request.json();
    const { title, model } = body;

    // Update thread
    const updatedThread = await RedisService.updateChatThread(userId, threadId, {
      title,
      model,
    });

    if (!updatedThread) {
      return NextResponse.json(
        { success: false, error: 'Failed to update thread' },
        { status: 500, headers: CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, thread: updatedThread },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Error updating thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update thread' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const { threadId } = params;
    
    // Get authenticated user using Supabase's route handler
    console.log('Getting authenticated user with createRouteHandlerClient...');
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No session found' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    const userId = session.user.id;
    console.log('User authenticated:', session.user.email);

    // Delete thread
    const success = await RedisService.deleteChatThread(userId, threadId);
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Thread not found or could not be deleted' },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Error deleting thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete thread' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
} 