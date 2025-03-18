import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { AUTH_CONFIG } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get the session ID from cookies
    const cookieStore = cookies();
    const sessionId = cookieStore.get(AUTH_CONFIG.COOKIE_NAME)?.value;
    
    if (sessionId) {
      try {
        // Get user ID from session before deleting it
        const session = await db
          .selectFrom('sessions')
          .where('id', '=', sessionId)
          .select(['user_id'])
          .executeTakeFirst();

        // Delete only auth-related sessions, not user data
        // This preserves Redis chat history while clearing login state
        if (session?.user_id) {
          console.log(`Force-logout: Deleting all sessions for user ${session.user_id}`);
          await db
            .deleteFrom('sessions')
            .where('user_id', '=', session.user_id)
            .execute();
        }

        // Delete the specific session as well
        await db
          .deleteFrom('sessions')
          .where('id', '=', sessionId)
          .execute();
      } catch (error) {
        console.error('Error deleting sessions:', error);
      }

      // Delete session cookie regardless of success
      cookieStore.delete(AUTH_CONFIG.COOKIE_NAME);
    }

    // CRITICAL: Target the exact NextAuth cookie names used in the logs
    const nextAuthCookies = [
      '__Host-next-auth.csrf-token',
      '__Secure-next-auth.callback-url',
      '__Secure-next-auth.session-token',
      'next-auth.csrf-token',
      'next-auth.callback-url',
      'next-auth.session-token'
    ];
    
    console.log('Force-logout: Explicitly clearing NextAuth cookies');
    
    // Delete each NextAuth cookie explicitly
    nextAuthCookies.forEach(cookieName => {
      const cookie = cookieStore.get(cookieName);
      if (cookie) {
        console.log(`Force-logout: Deleting cookie: ${cookieName}`);
        cookieStore.delete(cookieName);
        
        // Also set it as expired
        cookieStore.set({
          name: cookieName,
          value: '',
          expires: new Date(0),
          path: '/',
        });
      }
    });

    // Set response with cookie clearing headers
    const response = NextResponse.json({ success: true });
    
    // Set expired cookies in response headers as well
    nextAuthCookies.forEach(cookieName => {
      response.cookies.set({
        name: cookieName,
        value: '',
        expires: new Date(0),
        path: '/',
      });
    });

    return response;
  } catch (error) {
    console.error('Force logout error:', error);
    return NextResponse.json({ success: false, error: 'Failed to force logout' }, { status: 500 });
  }
}

// Completely wipe all auth cookies, session cookies, and force a redirect
// This ensures a clean break from the authenticated state
export async function GET(request: NextRequest) {
  console.log("Executing force-logout API endpoint");
  
  // Get cookie store to clear cookies server-side
  const cookieStore = cookies();
  
  // All possible auth related cookies we want to clear
  const cookiesToClear = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    '__Host-next-auth.session-token',
    'next-auth.csrf-token',
    '__Secure-next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
    '__Host-next-auth.callback-url',
    'session_token'
  ];
  
  // Log all cookies for debugging
  console.log("Cookies before clearing:", cookieStore.getAll().map(c => c.name));
  
  // Clear all auth cookies from server
  for (const name of cookiesToClear) {
    cookieStore.delete(name);
    // Also try with path
    cookieStore.delete({
      name,
      path: '/',
    });
  }
  
  // Create a response that redirects to the auth page with expired=true
  const response = NextResponse.redirect(new URL('/auth?expired=true&t=' + Date.now(), request.url), {
    status: 302
  });
  
  // Also clear cookies in the response headers for client side
  for (const name of cookiesToClear) {
    // Clear cookie with various options to ensure it's removed properly
    response.cookies.delete(name);
    
    // Different domains and paths to be thorough
    response.cookies.set({
      name,
      value: "",
      expires: new Date(0),
      path: "/",
    });
    
    // Also try with secure and httpOnly flags
    response.cookies.set({
      name,
      value: "",
      expires: new Date(0),
      path: "/",
      secure: true,
      httpOnly: true
    });
  }
  
  // Set cache control headers to prevent caching
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  console.log("Force logout completed, redirecting to auth page with expired=true");
  return response;
} 