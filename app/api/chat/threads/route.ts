import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { RedisService, verifyRedisConnection } from '@/lib/redis';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { AuthError } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Function to get user from auth token
async function getUserFromToken(authToken: string | null) {
  if (!authToken) {
    return { user: null, error: new Error('No auth token provided') as AuthError };
  }
  
  try {
    // Create a custom Supabase client with the token
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return null; // No cookies used for this client
          },
          set(name, value, options) {
            // No-op - we don't set cookies with this client
          },
          remove(name, options) {
            // No-op - we don't remove cookies with this client
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      }
    );
    
    const { data, error } = await supabase.auth.getUser();
    return { user: data.user, error };
  } catch (error) {
    console.error('Error getting user from token:', error);
    return { user: null, error: error as AuthError };
  }
}

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

    // Try to get user from Supabase auth
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    // If regular auth failed, try using the Authorization header if present
    let userId: string | undefined = user?.id;
    let authError: AuthError | null = error;
    
    if (!userId) {
      // Try to get auth token from header
      const authHeader = req.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '');
      
      if (token) {
        const { user: tokenUser, error: tokenError } = await getUserFromToken(token);
        if (tokenUser) {
          userId = tokenUser.id;
          authError = null;
        } else {
          authError = tokenError;
        }
      }
      
      // If still no user, try to get user ID from a custom header
      if (!userId) {
        const headerUserId = req.headers.get('x-user-id');
        if (headerUserId) {
          userId = headerUserId;
        }
      }
    }
    
    console.log('GET /api/chat/threads auth check:', { 
      hasUser: !!userId, 
      userId: userId,
      error: authError?.message 
    });
    
    if (!userId) {
      console.error('Auth error:', authError?.message || 'No user found');
      return NextResponse.json(
        { 
          error: 'Unauthorized', 
          message: authError?.message || 'Authentication required',
          authRequired: true 
        },
        { status: 401 }
      );
    }
    
    console.log(`Fetching threads for user: ${userId}`);
    
    // Get threads from Redis
    const threads = await RedisService.getUserChatThreads(userId);
    
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
    
    // Try to get user from Supabase auth
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    // If regular auth failed, try using the Authorization header if present
    let userId: string | undefined = user?.id;
    let authError: AuthError | null = error;
    
    if (!userId) {
      // Try to get auth token from header
      const authHeader = req.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '');
      
      if (token) {
        const { user: tokenUser, error: tokenError } = await getUserFromToken(token);
        if (tokenUser) {
          userId = tokenUser.id;
          authError = null;
        } else {
          authError = tokenError;
        }
      }
      
      // If still no user, try to get user ID from a custom header
      if (!userId) {
        const headerUserId = req.headers.get('x-user-id');
        if (headerUserId) {
          userId = headerUserId;
        }
      }
    }
    
    console.log('POST /api/chat/threads auth check:', { 
      hasUser: !!userId, 
      userId: userId,
      error: authError?.message 
    });
    
    if (!userId) {
      console.error('Auth error:', authError?.message || 'No user found');
      return NextResponse.json(
        { 
          error: 'Unauthorized', 
          message: authError?.message || 'Authentication required',
          authRequired: true 
        },
        { status: 401 }
      );
    }
    
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