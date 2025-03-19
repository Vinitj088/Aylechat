import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { RedisService } from '@/lib/redis';

export const dynamic = 'force-dynamic';

interface Params {
  params: {
    threadId: string;
  };
}

// No-cache headers
const CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache'
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    // Use Supabase to get user
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    const userId = session.user.id;
    const { threadId } = params;
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
    console.error('Error getting chat thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get chat thread' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    // Use Supabase to get user
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    const userId = session.user.id;
    const { threadId } = params;
    const body = await request.json();

    // Ensure the thread exists
    const existingThread = await RedisService.getChatThread(userId, threadId);
    if (!existingThread) {
      return NextResponse.json(
        { success: false, error: 'Thread not found' },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    // Update the thread
    const updatedThread = await RedisService.updateChatThread(userId, threadId, body);
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
    console.error('Error updating chat thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update chat thread' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    // Use Supabase to get user
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    const userId = session.user.id;
    const { threadId } = params;

    // Ensure the thread exists
    const existingThread = await RedisService.getChatThread(userId, threadId);
    if (!existingThread) {
      return NextResponse.json(
        { success: false, error: 'Thread not found' },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    // Delete the thread
    const success = await RedisService.deleteChatThread(userId, threadId);
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete thread' },
        { status: 500, headers: CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Error deleting chat thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete chat thread' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
} 