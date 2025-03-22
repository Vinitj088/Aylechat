import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { RedisService } from '@/lib/redis';
import { createServerClient } from '@supabase/ssr';
import { AuthError } from '@supabase/supabase-js';

// Change to auto for better performance
export const dynamic = 'auto';

// Cache these constants outside the handler for performance
const WARMUP_RESPONSE = NextResponse.json({ 
  success: true, 
  status: 'warmed_up',
  thread: { id: 'warmup-thread-id' }
}, { status: 200 });

const UNAUTHORIZED_RESPONSE = NextResponse.json(
  { 
    error: 'Unauthorized', 
    message: 'Authentication required',
    authRequired: true 
  },
  { status: 401 }
);

// Handle warmup requests specially
const handleWarmup = () => {
  return WARMUP_RESPONSE;
};

// Function to get user from auth token - same as in threads/route.ts
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

// Helper function to authenticate user with multiple methods
async function authenticateUser(req: NextRequest) {
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
  
  return { userId, authError };
}

// GET a specific thread
export async function GET(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const { threadId } = params;
    
    if (!threadId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Thread ID is required' 
      }, { status: 400 });
    }
    
    // Authenticate user
    const { userId, authError } = await authenticateUser(req);
    
    console.log(`GET /api/chat/threads/${threadId} auth check:`, { 
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
    
    // Get the thread from Redis
    const thread = await RedisService.getChatThread(userId, threadId);
    
    if (!thread) {
      return NextResponse.json({ 
        success: false, 
        error: 'Thread not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      thread
    });
    
  } catch (error: any) {
    console.error('Error getting thread:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to get thread' 
    }, { status: 500 });
  }
}

// PUT/UPDATE a specific thread
export async function PUT(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const { threadId } = params;
    
    if (!threadId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Thread ID is required' 
      }, { status: 400 });
    }
    
    // Parse request body
    const body = await req.json();
    
    // Handle warmup requests quickly
    if (body.warmup === true) {
      return handleWarmup();
    }
    
    const { messages, title, model } = body;
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Messages are required and must be an array' 
      }, { status: 400 });
    }
    
    // Authenticate user
    const { userId, authError } = await authenticateUser(req);
    
    // Log minimal debug info
    console.log(`PUT /thread/${threadId.substring(0, 8)}...`);
    
    if (!userId) {
      return UNAUTHORIZED_RESPONSE;
    }
    
    // Skip fetching the existing thread first - just update directly
    // This is more efficient and faster
    const updatedThread = await RedisService.updateChatThread(
      userId,
      threadId,
      {
        messages,
        title,
        model
      }
    );
    
    if (!updatedThread) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to update thread' 
      }, { status: 500 });
    }
    
    // Return a smaller response for better performance
    return NextResponse.json({
      success: true,
      thread: {
        id: updatedThread.id,
        title: updatedThread.title
      }
    });
    
  } catch (error: any) {
    console.error('Error updating thread:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to update thread' 
    }, { status: 500 });
  }
}

// DELETE a specific thread
export async function DELETE(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const { threadId } = params;
    
    if (!threadId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Thread ID is required' 
      }, { status: 400 });
    }
    
    // Authenticate user
    const { userId, authError } = await authenticateUser(req);
    
    console.log(`DELETE /api/chat/threads/${threadId} auth check:`, { 
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
    
    // Delete the thread
    const success = await RedisService.deleteChatThread(userId, threadId);
    
    if (!success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to delete thread' 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Thread deleted successfully'
    });
    
  } catch (error: any) {
    console.error('Error deleting thread:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to delete thread' 
    }, { status: 500 });
  }
} 