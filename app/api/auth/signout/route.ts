import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth-service';

export async function POST(request: NextRequest) {
  try {
    await authService.logout();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in signout route:', error);
    return NextResponse.json(
      { message: 'Failed to sign out' },
      { status: 500 }
    );
  }
} 