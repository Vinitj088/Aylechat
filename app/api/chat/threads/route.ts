import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { RedisService } from '@/lib/redis';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';

// No-cache headers
const CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache'
};

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user using Supabase's route handler
    console.log('API: Getting threads - retrieving auth session');
    
    // Create the Supabase client with cookie handling
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    // Log session details for debugging
    if (session) {
      console.log(`API: User session found - User: ${session.user.email}`);
    } else {
      console.log('API: No session found');
      if (authError) {
        console.error('API: Auth error:', authError.message);
      }

      const headerUserId = request.headers.get('x-auth-user-id');
      console.log(`API: User ID from header: ${headerUserId || 'none'}`);
    }
    
    // Handle normal authentication
    if (session?.user) {
      console.log('API: Fetching threads for user:', session.user.id);
      const userId = session.user.id;
      const threads = await RedisService.getUserChatThreads(userId);
      
      console.log(`API: Found ${threads.length} threads`);
      return NextResponse.json(
        { success: true, threads },
        { headers: CACHE_HEADERS }
      );
    }
    
    // If no session found, try header-based authentication as fallback
    // This is for middleware support
    const headerUserId = request.headers.get('x-auth-user-id');
    if (headerUserId) {
      console.log('API: Using user ID from header:', headerUserId);
      const threads = await RedisService.getUserChatThreads(headerUserId);
      
      console.log(`API: Found ${threads.length} threads using header auth`);
      return NextResponse.json(
        { success: true, threads },
        { headers: CACHE_HEADERS }
      );
    }
    
    // If no session, unauthorized
    return NextResponse.json(
      { success: false, error: 'Unauthorized: No valid session found' },
      { status: 401, headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('API Error getting chat threads:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get chat threads' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user using Supabase's route handler
    console.log('API: Creating thread - retrieving auth session');
    
    // Create the Supabase client with cookie handling
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    // Try header auth as fallback
    const headerUserId = request.headers.get('x-auth-user-id');
    let userId = session?.user?.id || headerUserId;
    
    // If no user ID, return unauthorized
    if (!userId) {
      console.error('API: No valid user ID found for thread creation');
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No valid user found' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }
    
    console.log('API: Creating thread for user:', userId);
    const body = await request.json();
    const { title, messages, model } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400, headers: CACHE_HEADERS }
      );
    }

    const thread = await RedisService.createChatThread(userId, title, messages || [], model || 'exa');
    
    if (!thread) {
      return NextResponse.json(
        { success: false, error: 'Failed to create chat thread' },
        { status: 500, headers: CACHE_HEADERS }
      );
    }

    console.log(`API: Thread created successfully with ID: ${thread.id}`);
    return NextResponse.json(
      { success: true, thread },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('API Error creating chat thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create chat thread' },
      { status: 500 }
    );
  }
} 