import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// This endpoint clears all Supabase authentication cookies to resolve parsing issues
export async function POST() {
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();
  
  // Log all auth-related cookies for debugging
  console.log('Auth cookies found:', allCookies
    .filter(cookie => 
      cookie.name.includes('auth') || 
      cookie.name.includes('supabase') || 
      cookie.name.includes('sb-')
    )
    .map(cookie => cookie.name)
  );

  // Clear all Supabase auth cookies
  const supabaseCookies = allCookies.filter(cookie => 
    cookie.name.includes('auth') || 
    cookie.name.includes('supabase') || 
    cookie.name.includes('sb-')
  );

  for (const cookie of supabaseCookies) {
    cookieStore.set({
      name: cookie.name,
      value: '',
      expires: new Date(0),
      path: '/',
    });
  }

  return NextResponse.json(
    { 
      success: true, 
      message: "Session cookies cleared", 
      clearedCookies: supabaseCookies.map(c => c.name)
    },
    { status: 200 }
  );
} 