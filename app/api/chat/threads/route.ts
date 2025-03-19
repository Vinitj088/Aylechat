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
    console.log('Getting authenticated user with createRouteHandlerClient...');
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    // Handle normal authentication
    if (session?.user) {
      console.log('User authenticated from session:', session.user.email);
      const userId = session.user.id;
      const threads = await RedisService.getUserChatThreads(userId);
      
      return NextResponse.json(
        { success: true, threads },
        { headers: CACHE_HEADERS }
      );
    }
    
    // Fallback to custom cookies if session not found
    const cookieStore = cookies();
    const userAuthCookie = cookieStore.get('user-authenticated');
    const userEmailCookie = cookieStore.get('user-email');
    
    // If we have our custom cookies, try to use them
    if (userAuthCookie && userEmailCookie && userEmailCookie.value) {
      console.log('Attempting to use backup cookies for:', userEmailCookie.value);
      
      try {
        // Create a mock user ID based on email if we can't query the database
        // This is a temporary solution until the profiles table is created
        const mockUserId = userEmailCookie.value.split('@')[0] + '-user';
        console.log('Using mock user ID for authentication:', mockUserId);
        const userId = mockUserId;
        const threads = await RedisService.getUserChatThreads(userId);
        
        return NextResponse.json(
          { success: true, threads },
          { headers: CACHE_HEADERS }
        );
      } catch (userLookupError) {
        console.error('Error in user lookup process:', userLookupError);
      }
    }
    
    // If all auth methods fail, return unauthorized
    if (authError) {
      console.error('Authentication error:', authError);
      return NextResponse.json(
        { success: false, error: 'Authentication error: ' + authError.message },
        { status: 401, headers: CACHE_HEADERS }
      );
    }
    
    console.error('No session or user found');
    return NextResponse.json(
      { success: false, error: 'Unauthorized: No session found' },
      { status: 401, headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Error getting chat threads:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get chat threads' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user using Supabase's route handler
    console.log('Getting authenticated user with createRouteHandlerClient...');
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    let userId = session?.user?.id;
    
    // If no session, try backup cookies
    if (!userId) {
      const cookieStore = cookies();
      const userAuthCookie = cookieStore.get('user-authenticated');
      const userEmailCookie = cookieStore.get('user-email');
      
      if (userAuthCookie && userEmailCookie && userEmailCookie.value) {
        console.log('Attempting to use backup cookies for:', userEmailCookie.value);
        
        // Create a mock user ID based on email (temporary solution)
        const mockUserId = userEmailCookie.value.split('@')[0] + '-user';
        console.log('Using mock user ID for authentication:', mockUserId);
        userId = mockUserId;
      }
    } else if (session && session.user) {
      console.log('User authenticated from session:', session.user.email);
    }
    
    // If we still don't have a user ID, return unauthorized
    if (!userId) {
      console.error('No user ID found after trying all authentication methods');
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user found' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

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

    return NextResponse.json(
      { success: true, thread },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Error creating chat thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create chat thread' },
      { status: 500 }
    );
  }
} 