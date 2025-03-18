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
          await db
            .deleteFrom('sessions')
            .where('user_id', '=', session.user_id)
            .execute();
          
          // Note: We intentionally do NOT delete Redis data here
          // Redis chat threads are preserved so users can access them after logging back in
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

    // Delete ALL auth-related cookies to ensure complete logout
    const allCookies = cookieStore.getAll();
    console.log('Force-logout: Clearing cookies:', allCookies.map(c => c.name).join(', '));
    
    allCookies.forEach(cookie => {
      if (cookie.name.includes('next-auth') || 
          cookie.name.includes('session') || 
          cookie.name === '__Secure-next-auth.session-token' ||
          cookie.name === '__Host-next-auth.csrf-token' ||
          cookie.name === 'next-auth.csrf-token' ||
          cookie.name === 'next-auth.callback-url' ||
          cookie.name === 'next-auth.session-token') {
        
        console.log(`Force-logout: Deleting cookie: ${cookie.name}`);
        
        // Delete with various path and domain combinations to ensure removal
        cookieStore.delete(cookie.name);
        cookieStore.set({
          name: cookie.name,
          value: '',
          expires: new Date(0),
          path: '/',
        });
      }
    });

    // Set a response with cookie clearing headers as well
    const response = NextResponse.json({ success: true });
    
    // Set expired cookies in response headers as well
    response.cookies.set({
      name: 'next-auth.session-token',
      value: '',
      expires: new Date(0),
      path: '/',
    });
    
    response.cookies.set({
      name: 'next-auth.csrf-token',
      value: '',
      expires: new Date(0),
      path: '/',
    });
    
    response.cookies.set({
      name: AUTH_CONFIG.COOKIE_NAME,
      value: '',
      expires: new Date(0),
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Force logout error:', error);
    return NextResponse.json({ success: false, error: 'Failed to force logout' }, { status: 500 });
  }
} 