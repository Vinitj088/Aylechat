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
  
  // If it's a protected route, check for session cookie
  if (isProtectedRoute) {
    const sessionCookie = request.cookies.get(AUTH_CONFIG.COOKIE_NAME)
    
    // If no session cookie, redirect to home
    if (!sessionCookie) {
      return NextResponse.redirect(new URL(AUTH_CONFIG.ROUTES.HOME, request.url))
    }
  }
  
  return NextResponse.next()
}

// Only run middleware on protected routes
export const config = {
  matcher: [
    '/chat/:path*',
    '/settings/:path*',
    '/profile/:path*',
  ]
} 