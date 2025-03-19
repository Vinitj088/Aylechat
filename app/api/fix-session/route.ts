import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get all cookies
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    
    // Find auth cookies to debug them
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('supabase') || 
      cookie.name.includes('sb-') || 
      cookie.name.includes('auth')
    );
    
    console.log('Auth cookies found:', authCookies.map(c => c.name));
    
    // Create a new supabase client with the request cookies
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Check current session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
    }
    
    // We'll just return status information - this endpoint is now just for checking and clearing cookies
    // We won't try to create a session if none exists, as that requires valid credentials
    
    // When there is a valid session, attempt to refresh it
    if (session) {
      console.log('Refreshing existing session...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Error refreshing session:', refreshError);
        return NextResponse.json({ 
          success: false, 
          error: refreshError.message,
          cookies: authCookies.map(c => c.name),
          sessionStatus: 'refresh_failed'
        });
      }
      
      if (!refreshData.session) {
        return NextResponse.json({ 
          success: false, 
          error: 'No session after refresh',
          cookies: authCookies.map(c => c.name),
          sessionStatus: 'refresh_no_session'
        });
      }
      
      // Session was successfully refreshed
      return NextResponse.json({
        success: true,
        message: 'Session refreshed successfully',
        user: refreshData.user,
        sessionStatus: 'refreshed',
        cookies: authCookies.map(c => `${c.name}=${c.value.substring(0, 5)}...`)
      }, {
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      });
    } else {
      // No session - we'll just return that information
      // The client-side code should handle redirecting to the login page if needed
      return NextResponse.json({
        success: false,
        message: 'No active session found',
        sessionStatus: 'no_session',
        cookies: authCookies.map(c => c.name)
      }, {
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      });
    }
  } catch (error) {
    console.error('Error fixing session:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  }
} 