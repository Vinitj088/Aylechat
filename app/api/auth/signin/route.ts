import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    try {
      const user = await authService.login(email, password);
      const session = await authService.createSession(user.id);
      
      return NextResponse.json({ user });
    } catch (error) {
      console.error('Login error:', error);
      return NextResponse.json(
        { message: error instanceof Error ? error.message : 'Invalid credentials' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Error in signin route:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 