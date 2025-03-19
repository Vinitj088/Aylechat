import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { RedisService } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// GET endpoint to list all threads for a user
export async function GET(req: NextRequest) {
  try {
    // Get user from cookie or auth
    const cookieStore = cookies();
    const userId = cookieStore.get('app-user-id')?.value;
    let authenticatedUserId = userId;
    
    // If no debug cookie, check Supabase auth
    if (!authenticatedUserId) {
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        );
      }
      
      authenticatedUserId = session.user.id;
    }
    
    // Get threads from Redis
    const threads = await RedisService.getUserChatThreads(authenticatedUserId);
    
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
    
    // Get user from cookie or auth
    const cookieStore = cookies();
    const userId = cookieStore.get('app-user-id')?.value;
    let authenticatedUserId = userId;
    
    // If no debug cookie, check Supabase auth
    if (!authenticatedUserId) {
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        );
      }
      
      authenticatedUserId = session.user.id;
    }
    
    // Generate title if not provided
    const threadTitle = title || (messages[0]?.content.substring(0, 50) + '...') || 'New Chat';
    
    // Create the thread
    const thread = await RedisService.createChatThread(
      authenticatedUserId,
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