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
  '/api/debug',
  '/api/auth-debug'
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
  
  // Create response to modify
  const res = NextResponse.next();
  
  // Create Supabase client for auth with cookie settings
  const supabase = createMiddlewareClient({ req: request, res });
  
  // Get the Supabase session
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Middleware auth error:', error);
  }
  
  if (session) {
    console.log(`Authenticated user: ${session.user.email} accessing ${pathname}`);
    
    // Add these headers to debug
    if (session.user.id) {
      res.headers.set('x-user-id', session.user.id);
    }
    if (session.user.email) {
      res.headers.set('x-user-email', session.user.email);
    }
    
    // Set a secure cookie to validate session on the client side
    // This is a backup mechanism to help track auth state
    res.cookies.set('auth-state', 'authenticated', { 
      path: '/',
      httpOnly: false, // Make it available to client JS
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 1 day
      sameSite: 'lax'
    });
  } else {
    console.log(`Unauthenticated access to ${pathname}`);
    // Clear the auth state cookie if no session
    res.cookies.set('auth-state', '', { maxAge: 0, path: '/' });
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
  
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
} 