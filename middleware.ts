import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

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
  
  // Handle reload parameter (used for clearing session)
  if (searchParams.has('reload') || searchParams.has('logout')) {
    console.log('Middleware: Detected reload/logout parameter');
    
    // Create a new response
    const response = NextResponse.next();
    
    // Clear all potential auth cookies to ensure clean state
    const cookiesToClear = [
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      '__Host-next-auth.session-token',
      'next-auth.csrf-token',
      '__Secure-next-auth.csrf-token',
      '__Host-next-auth.csrf-token',
      'next-auth.callback-url',
      '__Secure-next-auth.callback-url',
      '__Host-next-auth.callback-url',
      'session_token'
    ];
    
    for (const cookieName of cookiesToClear) {
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
    // Get the NextAuth.js token
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    
    // If no token, redirect to home
    if (!token) {
      const url = new URL('/', request.url);
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
    
    return response;
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