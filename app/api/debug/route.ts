import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser } from '@/lib/supabase-utils';
import { getServerSupabaseClient } from '@/lib/supabase-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('Debug API called');
    
    // Get all cookies
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    
    console.log('Available cookies:', allCookies.map(c => `${c.name}=${c.value.substring(0, 10)}...`));
    
    // Try to authenticate
    const { user, error } = await getAuthenticatedUser();
    
    if (error) {
      console.log('Authentication error:', error);
      return NextResponse.json({ 
        authenticated: false, 
        error,
        cookies: allCookies.map(c => c.name),
        message: 'Not authenticated'
      });
    }
    
    if (user) {
      console.log('User authenticated:', user.email);
      return NextResponse.json({ 
        authenticated: true, 
        email: user.email,
        id: user.id,
        cookies: allCookies.map(c => c.name)
      });
    }
    
    return NextResponse.json({ 
      authenticated: false,
      message: 'Unknown authentication state',
      cookies: allCookies.map(c => c.name) 
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({ 
      error: 'Debug API error', 
      message: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 