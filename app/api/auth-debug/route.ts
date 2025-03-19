import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

/**
 * This is a debug-only endpoint to help troubleshoot authentication issues
 * It returns the current authentication state and all relevant cookies
 */

export const dynamic = 'force-dynamic';

// No-cache headers to ensure we always get fresh data
const CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache'
};

export async function GET(request: NextRequest) {
  try {
    // Get all cookies
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    
    // Filter auth-related cookies for debugging
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('auth') || 
      cookie.name.includes('supabase') || 
      cookie.name.includes('user')
    );
    
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error('Auth debug - Authentication error:', authError);
      return NextResponse.json({
        authenticated: false,
        error: authError.message,
        authCookies: authCookies.map(c => ({ name: c.name, value: '***' })),
        allCookies: allCookies.map(c => c.name),
        timestamp: new Date().toISOString()
      }, { status: 200, headers: CACHE_HEADERS });
    }
    
    if (!session) {
      return NextResponse.json({
        authenticated: false,
        session: null,
        message: 'No session found',
        authCookies: authCookies.map(c => ({ name: c.name, value: '***' })),
        allCookies: allCookies.map(c => c.name),
        timestamp: new Date().toISOString()
      }, { status: 200, headers: CACHE_HEADERS });
    }
    
    // Return the authenticated user details (sanitized)
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        lastSignInAt: session.user.last_sign_in_at,
      },
      sessionExists: !!session, 
      authCookies: authCookies.map(c => ({ name: c.name, value: '***' })),
      allCookies: allCookies.map(c => c.name),
      timestamp: new Date().toISOString()
    }, { status: 200, headers: CACHE_HEADERS });
  } catch (error: any) {
    console.error('Auth debug error:', error);
    return NextResponse.json({ 
      error: 'Error debugging authentication',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500, headers: CACHE_HEADERS });
  }
} 