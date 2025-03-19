import { NextRequest, NextResponse } from 'next/server';
import { RedisService } from '@/lib/redis';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/supabase-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const { user, error } = await getAuthenticatedUser();
    
    if (error || !user) {
      return unauthorizedResponse();
    }

    const userId = user.id;
    const threads = await RedisService.getUserChatThreads(userId);
    
    return NextResponse.json(
      { success: true, threads },
      { 
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache'
        }
      }
    );
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
    // Get authenticated user
    const { user, error } = await getAuthenticatedUser();
    
    if (error || !user) {
      return unauthorizedResponse();
    }

    const userId = user.id;
    const body = await request.json();
    const { title, messages, model } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    const thread = await RedisService.createChatThread(userId, title, messages || [], model || 'exa');
    
    if (!thread) {
      return NextResponse.json(
        { success: false, error: 'Failed to create chat thread' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, thread },
      { 
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache'
        }
      }
    );
  } catch (error) {
    console.error('Error creating chat thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create chat thread' },
      { status: 500 }
    );
  }
} 