import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Get request headers for debugging
  const headerEntries = Array.from(request.headers.entries());
  const headerObj = Object.fromEntries(headerEntries);
  
  // Try to get Supabase session using auth-helpers-nextjs
  const cookieStore = cookies();
  try {
    // Get all cookies for debugging
    const allCookies = cookieStore.getAll().map(c => ({
      name: c.name,
      value: c.value.substring(0, 10) + '...'
    }));
    
    // Create Supabase client with the correct middleware
    const supabase = createRouteHandlerClient({ cookies });
    
    // Try to get the session
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        cookies: allCookies,
        headers: headerObj
      });
    }
    
    if (data.session) {
      return NextResponse.json({
        success: true,
        user: {
          id: data.session.user.id,
          email: data.session.user.email,
          role: data.session.user.role
        },
        cookieCount: allCookies.length,
        cookies: allCookies,
        headers: headerObj
      });
    }
    
    return NextResponse.json({
      success: false,
      message: 'No session found',
      cookieCount: allCookies.length,
      cookies: allCookies,
      headers: headerObj
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
} 