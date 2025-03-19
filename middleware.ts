import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

// Protected client routes that require auth
const PROTECTED_ROUTES = ['/chat', '/settings', '/profile']

// Public API routes that don't need auth
const PUBLIC_API_ROUTES = ['/api/auth', '/api/migration', '/api/debug', '/api/auth-debug']

// Protected API routes that require auth
const PROTECTED_API_ROUTES = ['/api/chat', '/api/exaanswer', '/api/groq']

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // Skip auth check for public routes and assets
  if (
    path.startsWith('/_next') || 
    path.startsWith('/favicon.ico') ||
    PUBLIC_API_ROUTES.some(route => path.startsWith(route))
  ) {
    return NextResponse.next()
  }
  
  // Check if this is a protected route
  const isProtectedPage = PROTECTED_ROUTES.some(route => path.startsWith(route))
  const isProtectedApi = PROTECTED_API_ROUTES.some(route => path.startsWith(route))
  
  // If not a protected route, continue
  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next()
  }
  
  // Create response to modify
  const res = NextResponse.next()
  
  // Check for auth with Supabase
  try {
    const supabase = createMiddlewareClient({ req: request, res })
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user) {
      // Found a session, add user info to headers
      const requestHeaders = new Headers(request.headers)
      if (session.user.email) {
        requestHeaders.set('x-auth-email', session.user.email)
      }
      requestHeaders.set('x-auth-user-id', session.user.id)
      
      // Create new response with headers
      const newRes = NextResponse.next({
        request: {
          headers: requestHeaders
        }
      })
      
      // Copy cookies from original response
      res.cookies.getAll().forEach(cookie => {
        newRes.cookies.set(cookie.name, cookie.value, cookie)
      })
      
      return newRes
    }
    
    // No session, handle unauthorized access
    
    // For API routes, return 401
    if (isProtectedApi) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // For pages, redirect to sign in
    const redirectUrl = new URL('/', request.url)
    return NextResponse.redirect(redirectUrl)
    
  } catch (error) {
    // Error handling
    
    // For API routes, return error
    if (isProtectedApi) {
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      )
    }
    
    // For client routes, redirect to sign in
    if (isProtectedPage) {
      const redirectUrl = new URL('/', request.url)
      return NextResponse.redirect(redirectUrl)
    }
    
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
} 