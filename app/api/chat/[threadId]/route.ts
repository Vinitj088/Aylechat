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

    // Get thread
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
    console.error('Error getting thread:', error);
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