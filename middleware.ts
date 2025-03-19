import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

// Protected routes that require authentication
const protectedRoutes = [
  '/chat',
  '/settings',
  '/profile',
];

// Public routes that don't require API authentication
const publicApiRoutes = [
  '/api/auth',
  '/api/migration',
  '/api/debug'
];

// API routes that require authentication
const protectedApiRoutes = [
  '/api/chat',
  '/api/exaanswer',
  '/api/groq',
];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  console.log(`Middleware processing: ${pathname}`);
  
  // Create Supabase client for auth
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });
  
  // Get the Supabase session
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Middleware auth error:', error);
  }
  
  if (session) {
    console.log(`Authenticated user: ${session.user.email} accessing ${pathname}`);
  } else {
    console.log(`Unauthenticated access to ${pathname}`);
  }
  
  // Skip auth check for public API routes
  if (publicApiRoutes.some(route => pathname.startsWith(route))) {
    console.log(`Public API route detected: ${pathname}`);
    return res;
  }
  
  // Check for protected routes that require authentication
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  // Check for protected API routes
  const isProtectedApiRoute = protectedApiRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  // If it's a protected API route and there's no session, return 401
  if (isProtectedApiRoute && !session) {
    console.log(`Unauthorized API access to ${pathname}`);
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  // If it's a protected client route and there's no session, redirect to home
  if (isProtectedRoute && !session) {
    console.log(`Redirecting unauthenticated user from ${pathname} to home`);
    const url = new URL('/?authRequired=true', request.url);
    return NextResponse.redirect(url);
  }
  
  // Set cookies for authenticated users
  if (session) {
    res.cookies.set('sb-authenticated', 'true', { 
      maxAge: 60 * 60 * 24, // 1 day
      path: '/'  
    });
  }
  
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
} 