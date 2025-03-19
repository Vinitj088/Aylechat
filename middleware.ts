import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { AUTH_COOKIE_NAMES } from '@/lib/session-utils'

// Protected routes that require authentication
const protectedRoutes = [
  '/chat',
  '/settings',
  '/profile',
];

// Public routes that don't require API authentication
const publicApiRoutes = [
  '/api/auth'
];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  // Get the NextAuth.js token early so it's available for all checks
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  
  // Handle reload parameter (used for clearing session)
  if (searchParams.has('reload') || searchParams.has('logout')) {
    console.log('Middleware: Detected reload/logout parameter');
    
    // Create a new response
    const response = NextResponse.next();
    
    // Clear all auth cookies using our constant list
    for (const cookieName of AUTH_COOKIE_NAMES) {
      response.cookies.delete(cookieName);
      
      // Also set expired cookies to ensure they're cleared
      response.cookies.set({
        name: cookieName,
        value: '',
        expires: new Date(0),
        path: '/',
      });
    }
    
    return response;
  }
  
  // Skip auth check for public API routes
  if (publicApiRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Check for protected routes that require authentication
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  if (isProtectedRoute) {
    // If no token, redirect to home
    if (!token) {
      const url = new URL('/?authRequired=true', request.url);
      return NextResponse.redirect(url);
    }
  }
  
  // Add cache control headers to API requests to prevent caching
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    
    // Add cache control headers to prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    // If no token is found and this isn't a public API route, return 401
    if (!token) {
      const response = NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
      response.headers.set('Cache-Control', 'no-store, must-revalidate');
      return response;
    }
    
    return response;
  }
  
  // For non-API protected routes, redirect to auth page if not authenticated
  if (!token && pathname !== '/') {
    return NextResponse.redirect(new URL('/?authRequired=true', request.url));
  }
  
  return NextResponse.next();
}

// Run middleware on protected routes and API routes
export const config = {
  matcher: [
    '/',
    '/chat/:path*',
    '/settings/:path*',
    '/profile/:path*',
    '/api/:path*',
  ]
} 