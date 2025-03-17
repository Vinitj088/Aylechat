import { NextRequest, NextResponse } from 'next/server';
import { RedisService } from '@/lib/redis';
import { authService } from '@/lib/auth-service';

interface Params {
  params: {
    threadId: string;
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await authService.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { threadId } = params;
    const thread = await RedisService.getChatThread(user.id, threadId);

    if (!thread) {
      return NextResponse.json(
        { success: false, error: 'Thread not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, thread });
  } catch (error) {
    console.error('Error getting chat thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get chat thread' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await authService.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { threadId } = params;
    const body = await request.json();
    const { messages, title } = body;

    // Create updates object with only provided fields
    const updates: any = {};
    if (messages) updates.messages = messages;
    if (title) updates.title = title;

    const thread = await RedisService.updateChatThread(user.id, threadId, updates);

    if (!thread) {
      return NextResponse.json(
        { success: false, error: 'Thread not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, thread });
  } catch (error) {
    console.error('Error updating chat thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update chat thread' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await authService.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { threadId } = params;
    const success = await RedisService.deleteChatThread(user.id, threadId);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Thread not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete chat thread' },
      { status: 500 }
    );
  }
} 