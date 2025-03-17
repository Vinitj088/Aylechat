import { NextRequest, NextResponse } from 'next/server';
import { RedisService } from '@/lib/redis';
import { authService } from '@/lib/auth-service';

export async function GET(request: NextRequest) {
  try {
    const user = await authService.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const threads = await RedisService.getUserChatThreads(user.id);
    return NextResponse.json({ success: true, threads });
  } catch (error) {
    console.error('Error getting chat threads:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get chat threads' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authService.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, messages } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    const thread = await RedisService.createChatThread(user.id, title, messages || []);
    
    if (!thread) {
      return NextResponse.json(
        { success: false, error: 'Failed to create chat thread' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, thread });
  } catch (error) {
    console.error('Error creating chat thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create chat thread' },
      { status: 500 }
    );
  }
} 