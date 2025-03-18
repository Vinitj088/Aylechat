import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;
    
    if (!email || !password || !name) {
      return NextResponse.json(
        { message: 'Email, password, and name are required' },
        { status: 400 }
      );
    }
    
    try {
      const user = await authService.signup(email, password, name);
      const session = await authService.createSession(user.id);
      
      return NextResponse.json({ user });
    } catch (error) {
      console.error('Signup error:', error);
      return NextResponse.json(
        { message: error instanceof Error ? error.message : 'Signup failed' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in signup route:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 