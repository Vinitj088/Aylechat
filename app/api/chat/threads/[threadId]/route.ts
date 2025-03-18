import { NextRequest, NextResponse } from 'next/server';
import { RedisService } from '@/lib/redis';
import { getToken } from 'next-auth/jwt';

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
    // Use JWT token to get user
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!token || !token.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    const userId = token.id as string;
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
    // Use JWT token to get user
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!token || !token.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    const userId = token.id as string;
    const { threadId } = params;
    const body = await request.json();
    const { messages, title } = body;

    // Log information for debugging
    console.log(`Updating thread ${threadId} for user ${userId}`);
    console.log(`Message count: ${messages?.length || 0}`);

    // Create updates object with only provided fields
    const updates: any = {};
    if (messages) updates.messages = messages;
    if (title) updates.title = title;

    // Validate message format
    if (messages) {
      try {
        // Quick test serialization to catch issues early
        JSON.parse(JSON.stringify(messages));
      } catch (error) {
        console.error('Invalid message format:', error);
        return NextResponse.json(
          { success: false, error: 'Invalid message format' },
          { status: 400, headers: CACHE_HEADERS }
        );
      }
    }

    const thread = await RedisService.updateChatThread(userId, threadId, updates);

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
    console.error('Error updating chat thread:', error);
    return NextResponse.json(
      { success: false, error: `Failed to update chat thread: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    // Use JWT token to get user
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!token || !token.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    const userId = token.id as string;
    const { threadId } = params;
    const success = await RedisService.deleteChatThread(userId, threadId);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Thread not found' },
        { status: 404, headers: CACHE_HEADERS }
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