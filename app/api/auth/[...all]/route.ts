import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth-service';
import { createTablesIfNotExist } from '@/lib/db-utils';

// Ensure database tables exist
createTablesIfNotExist().catch(console.error);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, password, name } = body;

    if (action === 'login') {
      const user = await authService.login(email, password);
      await authService.createSession(user.id);
      return NextResponse.json({ success: true, user });
    } 
    
    if (action === 'signup') {
      const user = await authService.signup(email, password, name);
      await authService.createSession(user.id);
      return NextResponse.json({ success: true, user });
    }
    
    if (action === 'logout') {
      await authService.logout();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Auth API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authService.getUser();
    
    if (user) {
      return NextResponse.json({ success: true, user });
    } else {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Auth API error:', error);
    return NextResponse.json(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }
} 