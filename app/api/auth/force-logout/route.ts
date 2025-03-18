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

    // Delete any other auth cookies just to be safe
    cookieStore.getAll().forEach(cookie => {
      if (cookie.name.includes('next-auth') || cookie.name.includes('session')) {
        cookieStore.delete(cookie.name);
      }
    });

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Force logout error:', error);
    return NextResponse.json({ success: false, error: 'Failed to force logout' }, { status: 500 });
  }
} 