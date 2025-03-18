import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth-service';

export async function GET(request: NextRequest) {
  try {
    const user = await authService.getUser();
    
    if (!user) {
      return NextResponse.json({ user: null });
    }
    
    // Current date plus 30 days
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    
    return NextResponse.json({
      user,
      expires: expires.toISOString()
    });
  } catch (error) {
    console.error('Error in session route:', error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
} 