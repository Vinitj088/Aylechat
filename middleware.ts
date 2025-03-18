import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { AUTH_CONFIG } from '@/lib/constants'

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  // Define protected routes that require authentication
  const protectedRoutes = [
    AUTH_CONFIG.ROUTES.CHAT,
    AUTH_CONFIG.ROUTES.SETTINGS,
    AUTH_CONFIG.ROUTES.PROFILE,
  ]
  
  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )
  
  // Skip auth check for auth API routes
  const isAuthRoute = request.nextUrl.pathname.startsWith('/api/auth/')
  
  // If it's a protected route, check for session cookie
  if (isProtectedRoute && !isAuthRoute) {
    const sessionCookie = request.cookies.get(AUTH_CONFIG.COOKIE_NAME)
    
    // If no session cookie, redirect to home
    if (!sessionCookie) {
      return NextResponse.redirect(new URL(AUTH_CONFIG.ROUTES.HOME, request.url))
    }
  }
  
  // Add cache control headers to API requests to prevent caching
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    
    // Add cache control headers to prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  }
  
  return NextResponse.next()
}

// Run middleware on protected routes and API routes
export const config = {
  matcher: [
    '/chat/:path*',
    '/settings/:path*',
    '/profile/:path*',
    '/api/:path*',
  ]
} 