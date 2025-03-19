import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/chat',
  '/settings',
  '/profile'
]

// API routes that require authentication
const PROTECTED_API_ROUTES = [
  '/api/chat',
  '/api/chat/threads'
]

// Routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/auth',
  '/api/health',
  '/api/fix-session',
  '/api/exaanswer',
  '/api/groq'
]

// Default cache control headers to ensure fresh auth state
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip middleware for static assets and public routes
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/auth/') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))
  ) {
    return NextResponse.next()
  }
  
  // Check if the request is for a protected route
  const isProtectedPage = PROTECTED_ROUTES.some(route => pathname.startsWith(route))
  const isProtectedApi = PROTECTED_API_ROUTES.some(route => pathname.startsWith(route))
  
  // Skip auth check for non-protected routes
  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next()
  }
  
  // Create a response that we'll use if the user is unauthorized
  const res = NextResponse.next();

  // Default cache control headers to ensure we always have fresh auth state
  res.headers.set('Cache-Control', 'no-store, max-age=0');

  try {
    // Use Supabase auth
    const supabase = createMiddlewareClient({ req: request, res });
    
    // Refresh session to ensure it's valid
    const authResponse = await supabase.auth.getSession()
    const { data: { session }, error } = authResponse
    
    // Try refreshing the token if we have a session but there was an error
    if (session && error) {
      console.log('Attempting to refresh token in middleware')
      const refreshResult = await supabase.auth.refreshSession()
      
      if (refreshResult.error) {
        // If refresh fails, treat as no session
        console.error('Token refresh failed:', refreshResult.error.message)
      } else if (refreshResult.data.session) {
        // Successfully refreshed
        console.log('Successfully refreshed token in middleware')
        const newResponse = NextResponse.next({
          headers: NO_CACHE_HEADERS
        })
        
        // Add user info to headers
        newResponse.headers.set('x-user-id', refreshResult.data.session.user.id)
        
        if (refreshResult.data.session.user.email) {
          newResponse.headers.set('x-user-email', refreshResult.data.session.user.email)
        }
        
        // Set auth token
        newResponse.headers.set('x-auth-token', refreshResult.data.session.access_token)
        
        return newResponse
      }
    }
    
    // Handle authentication errors
    if (error) {
      console.error('Auth error in middleware:', error.message)
      
      if (isProtectedApi) {
        console.log(`Returning 401 for protected API with auth error: ${pathname}`)
        return NextResponse.json(
          { error: 'Authentication error', message: error.message },
          { status: 401, headers: NO_CACHE_HEADERS }
        )
      }
      
      // Redirect to auth page with error message
      const redirectUrl = new URL('/', request.url)
      redirectUrl.searchParams.set('error', 'auth_error')
      console.log(`Redirecting to auth page due to auth error: ${redirectUrl.toString()}`)
      return NextResponse.redirect(redirectUrl)
    }
    
    // If there's no session but the route requires auth
    if (!session) {
      if (isProtectedApi) {
        // Return 401 for API routes
        console.log(`Returning 401 for protected API with no session: ${pathname}`)
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401, headers: NO_CACHE_HEADERS }
        )
      }
      
      // Redirect page requests to auth page
      const redirectUrl = new URL('/', request.url)
      redirectUrl.searchParams.set('redirect', encodeURIComponent(pathname))
      console.log(`Redirecting to auth page due to no session: ${redirectUrl.toString()}`)
      return NextResponse.redirect(redirectUrl)
    }
    
    // User is authenticated, add auth headers for API routes
    if (session) {
      console.log(`User is authenticated, proceeding with ${pathname}`)
      const newResponse = NextResponse.next({
        headers: NO_CACHE_HEADERS
      })
      
      // Add user info to headers
      newResponse.headers.set('x-user-id', session.user.id)
      
      if (session.user.email) {
        newResponse.headers.set('x-user-email', session.user.email)
      }
      
      // Set auth token
      newResponse.headers.set('x-auth-token', session.access_token)
      
      return newResponse
    }
    
    // Default case: proceed with the request
    return res
  } catch (error) {
    console.error('Middleware error:', error)
    
    // Handle errors in protected routes
    if (isProtectedApi) {
      return NextResponse.json(
        { error: 'Authentication error', message: 'Internal server error' },
        { status: 500, headers: NO_CACHE_HEADERS }
      )
    }
    
    // Redirect to home with error parameter
    const redirectUrl = new URL('/', request.url)
    redirectUrl.searchParams.set('error', 'server_error')
    return NextResponse.redirect(redirectUrl)
  }
}

// Configure the middleware to run on all routes
export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.ico$).*)'],
} 