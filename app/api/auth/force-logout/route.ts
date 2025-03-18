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