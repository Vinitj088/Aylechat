import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { RedisService, verifyRedisConnection } from '@/lib/redis';
import { AuthError } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// GET endpoint to list all threads for a user
export async function GET(req: NextRequest) {
  try {
    // Verify Redis connection first
    const redisConnected = await verifyRedisConnection();
    if (!redisConnected) {
      console.error('Redis connection failed');
      return NextResponse.json(
        { error: 'Service unavailable', message: 'Database connection error' },
        { status: 503 }
      );
    }

    // Get user from Supabase auth
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    // Check if we have a valid user
    if (error || !user) {
      console.error('Auth error:', error?.message || 'No user found');
      return NextResponse.json(
        { 
          error: 'Unauthorized', 
          message: error?.message || 'Authentication required',
          authRequired: true 
        },
        { status: 401 }
      );
    }
    
    const userId = user.id;
    console.log(`Fetching threads for user: ${userId}`);

    // Check for query params
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const withMessages = searchParams.get('withMessages') === 'true';
    const limit = limitParam ? Math.max(1, Math.min(50, parseInt(limitParam))) : 10;

    let threads;
    if (withMessages) {
      threads = await RedisService.getLatestUserChatThreadsWithMessages(userId, limit);
    } else {
      threads = await RedisService.getUserChatThreads(userId);
    }

    return NextResponse.json({
      success: true,
      threads: threads || []
    });
    
  } catch (error: any) {
    console.error('Error getting threads:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to get threads' 
    }, { status: 500 });
  }
}

// POST endpoint to create a new thread
export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const body = await req.json();
    const { messages, title, model = 'exa' } = body;
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Messages are required and must be an array' 
      }, { status: 400 });
    }
    
    // Get user from Supabase auth
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    // Check if we have a valid user
    if (error || !user) {
      console.error('Auth error:', error?.message || 'No user found');
      return NextResponse.json(
        { 
          error: 'Unauthorized', 
          message: error?.message || 'Authentication required',
          authRequired: true 
        },
        { status: 401 }
      );
    }
    
    const userId = user.id;
    
    // Generate title if not provided
    const threadTitle = title || (messages[0]?.content.substring(0, 50) + '...') || 'New Chat';
    
    // Create the thread
    const thread = await RedisService.createChatThread(
      userId,
      threadTitle,
      messages,
      model
    );
    
    if (!thread) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create thread' 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      thread
    });
    
  } catch (error: any) {
    console.error('Error creating thread:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to create thread' 
    }, { status: 500 });
  }
}

// DELETE endpoint to clear all threads for a user
export async function DELETE(req: NextRequest) {
  try {
    // Verify Redis connection first
    const redisConnected = await verifyRedisConnection();
    if (!redisConnected) {
      console.error('Redis connection failed during clear all');
      return NextResponse.json(
        { error: 'Service unavailable', message: 'Database connection error' },
        { status: 503 }
      );
    }

    // Get user from Supabase auth
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    // Check if we have a valid user
    if (error || !user) {
      console.error('Auth error on DELETE /threads:', error?.message || 'No user found');
      return NextResponse.json(
        { 
          error: 'Unauthorized', 
          message: error?.message || 'Authentication required',
          authRequired: true 
        },
        { status: 401 }
      );
    }
    
    const userId = user.id;
    console.log(`Attempting to delete all threads for user: ${userId}`);
    
    // Call Redis service to delete all threads for the user
    const deleteCount = await RedisService.deleteAllUserChatThreads(userId);
    
    console.log(`Deleted ${deleteCount} threads for user: ${userId}`);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deleteCount} chat threads.`,
      deletedCount: deleteCount
    });
    
  } catch (error: any) {
    console.error('Error deleting all threads:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete threads', 
      message: error.message || 'An internal server error occurred' 
    }, { status: 500 });
  }
} 