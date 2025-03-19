import { NextRequest, NextResponse } from 'next/server';
import { RedisService } from '@/lib/redis';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';

// No-cache headers
const CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache'
};

export async function GET(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const { threadId } = params;

    // Get authenticated user using Supabase's route handler
    console.log('Getting authenticated user with createRouteHandlerClient...');
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    let userId = null;
    
    // Handle normal authentication
    if (session?.user) {
      console.log('User authenticated from session:', session.user.email);
      userId = session.user.id;
    } else {
      // Fallback to custom cookies if session not found
      const cookieStore = cookies();
      const userAuthCookie = cookieStore.get('user-authenticated');
      const userEmailCookie = cookieStore.get('user-email');
      
      // If we have our custom cookies, try to use them
      if (userAuthCookie && userEmailCookie && userEmailCookie.value) {
        console.log('Attempting to use backup cookies for:', userEmailCookie.value);
        
        try {
          // Try to get user by email from Supabase
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('email', userEmailCookie.value)
            .single();
          
          if (userData?.id) {
            console.log('Found user ID from email cookie:', userData.id);
            userId = userData.id;
          } else if (userError) {
            console.error('Error looking up user by email:', userError);
          }
        } catch (userLookupError) {
          console.error('Error in user lookup process:', userLookupError);
        }
      }
    }
    
    // If still no user ID, return unauthorized
    if (!userId) {
      if (authError) {
        console.error('Authentication error:', authError);
      }
      console.error('No valid user authentication found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No valid authentication found' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    // Get thread
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
    console.error('Error getting thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get thread' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const { threadId } = params;
    
    // Get authenticated user using Supabase's route handler
    console.log('Getting authenticated user with createRouteHandlerClient...');
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    let userId = null;
    
    // Handle normal authentication
    if (session?.user) {
      console.log('User authenticated from session:', session.user.email);
      userId = session.user.id;
    } else {
      // Fallback to custom cookies if session not found
      const cookieStore = cookies();
      const userAuthCookie = cookieStore.get('user-authenticated');
      const userEmailCookie = cookieStore.get('user-email');
      
      // If we have our custom cookies, try to use them
      if (userAuthCookie && userEmailCookie && userEmailCookie.value) {
        console.log('Attempting to use backup cookies for:', userEmailCookie.value);
        
        try {
          // Try to get user by email from Supabase
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('email', userEmailCookie.value)
            .single();
          
          if (userData?.id) {
            console.log('Found user ID from email cookie:', userData.id);
            userId = userData.id;
          } else if (userError) {
            console.error('Error looking up user by email:', userError);
          }
        } catch (userLookupError) {
          console.error('Error in user lookup process:', userLookupError);
        }
      }
    }
    
    // If still no user ID, return unauthorized
    if (!userId) {
      if (authError) {
        console.error('Authentication error:', authError);
      }
      console.error('No valid user authentication found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No valid authentication found' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    // Verify thread exists and is owned by user
    const existingThread = await RedisService.getChatThread(userId, threadId);
    if (!existingThread) {
      return NextResponse.json(
        { success: false, error: 'Thread not found' },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    const body = await request.json();
    const { title, model } = body;

    // Update thread
    const updatedThread = await RedisService.updateChatThread(userId, threadId, {
      title,
      model,
    });

    if (!updatedThread) {
      return NextResponse.json(
        { success: false, error: 'Failed to update thread' },
        { status: 500, headers: CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, thread: updatedThread },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Error updating thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update thread' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const { threadId } = params;
    
    // Get authenticated user using Supabase's route handler
    console.log('Getting authenticated user with createRouteHandlerClient...');
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    let userId = null;
    
    // Handle normal authentication
    if (session?.user) {
      console.log('User authenticated from session:', session.user.email);
      userId = session.user.id;
    } else {
      // Fallback to custom cookies if session not found
      const cookieStore = cookies();
      const userAuthCookie = cookieStore.get('user-authenticated');
      const userEmailCookie = cookieStore.get('user-email');
      
      // If we have our custom cookies, try to use them
      if (userAuthCookie && userEmailCookie && userEmailCookie.value) {
        console.log('Attempting to use backup cookies for:', userEmailCookie.value);
        
        try {
          // Try to get user by email from Supabase
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('email', userEmailCookie.value)
            .single();
          
          if (userData?.id) {
            console.log('Found user ID from email cookie:', userData.id);
            userId = userData.id;
          } else if (userError) {
            console.error('Error looking up user by email:', userError);
          }
        } catch (userLookupError) {
          console.error('Error in user lookup process:', userLookupError);
        }
      }
    }
    
    // If still no user ID, return unauthorized
    if (!userId) {
      if (authError) {
        console.error('Authentication error:', authError);
      }
      console.error('No valid user authentication found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No valid authentication found' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    // Delete thread
    const success = await RedisService.deleteChatThread(userId, threadId);
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Thread not found or could not be deleted' },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Error deleting thread:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete thread' },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
} 