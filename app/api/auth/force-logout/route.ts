import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { AUTH_CONFIG } from '@/lib/constants';
import { clearAuthCookiesInResponse, AUTH_COOKIE_NAMES } from '@/lib/session-utils';

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
    }

    // Create response
    const response = NextResponse.json({ success: true });
    
    // Clear all auth cookies using our utility
    clearAuthCookiesInResponse(response);

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
  
  // Create a response that redirects to the homepage with expired=true
  const response = NextResponse.redirect(new URL(`/?expired=true&t=${Date.now()}`, request.url), {
    status: 302
  });
  
  // Clear all cookies using our utility function
  clearAuthCookiesInResponse(response);
  
  // Set cache control headers to prevent caching
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  console.log("Force logout completed, redirecting to homepage with expired=true");
  return response;
} 