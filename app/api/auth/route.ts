import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth-service';
import { createTablesIfNotExist } from '@/lib/db-utils';
import { AUTH_CONFIG } from '@/lib/constants';

// Ensure database tables exist
createTablesIfNotExist().catch(console.error);

export async function GET(req: NextRequest) {
  try {
    const user = await authService.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { 
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ success: false, error: 'Authentication check failed' }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, password, name } = body;

    switch (action) {
      case 'login': {
        if (!email || !password) {
          return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
        }

        const user = await authService.login(email, password);
        const session = await authService.createSession(user.id);
        
        // Create response with cookie
        const response = NextResponse.json({ success: true, user });
        
        // Set cookie manually to ensure it's properly set
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
        
        response.cookies.set({
          name: AUTH_CONFIG.COOKIE_NAME,
          value: session.id,
          expires: expiresAt,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/'
        });
        
        return response;
      }

      case 'signup': {
        if (!email || !password || !name) {
          return NextResponse.json({ success: false, error: 'Email, password, and name are required' }, { status: 400 });
        }

        const user = await authService.signup(email, password, name);
        const session = await authService.createSession(user.id);
        
        // Create response with cookie
        const response = NextResponse.json({ success: true, user });
        
        // Set cookie manually to ensure it's properly set
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
        
        response.cookies.set({
          name: AUTH_CONFIG.COOKIE_NAME,
          value: session.id,
          expires: expiresAt,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/'
        });
        
        return response;
      }

      case 'logout': {
        await authService.logout();
        
        // Create response and clear cookie
        const response = NextResponse.json({ success: true });
        response.cookies.delete(AUTH_CONFIG.COOKIE_NAME);
        
        return response;
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Auth action error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Authentication action failed' }, { status: 500 });
  }
} 