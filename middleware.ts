import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

// Protected client routes that should redirect to the sign-in page
const PROTECTED_ROUTES = ['/chat', '/settings', '/profile']

// Public API routes that don't need auth
const PUBLIC_API_ROUTES = ['/api/auth', '/api/migration', '/api/debug', '/api/auth-debug']

// Protected API routes that return 401 unauthorized
const PROTECTED_API_ROUTES = ['/api/chat', '/api/exaanswer', '/api/groq']

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // Clone the request headers and set a new response
  const requestHeaders = new Headers(request.headers)
  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  
  // Create supabase middleware client
  const supabase = createMiddlewareClient({ req: request, res })

  console.log('Middleware processing:', path)
  
  // Check for auth-related cookies
  const cookies = request.cookies
  const hasBackupAuth = cookies.has('user-authenticated')
  const hasBackupEmail = cookies.has('user-email')
  const userEmail = cookies.get('user-email')?.value || 'unknown'
  
  if (hasBackupAuth && hasBackupEmail) {
    console.log('Using backup cookies for', userEmail)
    // Set a header so the API routes know we've authenticated with cookies
    requestHeaders.set('x-auth-email', userEmail)
    requestHeaders.set('x-auth-method', 'cookie')
  }
  
  // For public API routes, skip session check
  if (PUBLIC_API_ROUTES.some(route => path.startsWith(route))) {
    console.log('Public API route detected:', path)
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }
  
  // Check if we're dealing with a protected page
  const isProtectedPage = PROTECTED_ROUTES.some(route => path.startsWith(route))
  const isProtectedApi = PROTECTED_API_ROUTES.some(route => path.startsWith(route))
  
  // If not a protected route, continue without checking auth
  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }
  
  try {
    // Get the user's session
    const { data: { session } } = await supabase.auth.getSession()
    
    // If we have a session, add the user email to headers
    if (session?.user) {
      console.log('User authenticated in middleware:', session.user.email || 'no-email')
      if (session.user.email) {
        requestHeaders.set('x-auth-email', session.user.email)
      }
      requestHeaders.set('x-auth-method', 'session')
      requestHeaders.set('x-auth-user-id', session.user.id)
      
      // Set a secure cookie for the client to know it's authenticated
      res.cookies.set('user-authenticated', 'true', { 
        maxAge: 30 * 24 * 60 * 60, // 30 days
        httpOnly: false,
        secure: true,
        sameSite: 'lax'
      })
      
      // Only set the email cookie if email exists
      if (session.user.email) {
        res.cookies.set('user-email', session.user.email, {
          maxAge: 30 * 24 * 60 * 60, // 30 days
          httpOnly: false,
          secure: true,
          sameSite: 'lax'
        })
      }
      
      return res
    }
    
    // If no session but we have backup cookies, allow access for now
    if (hasBackupAuth && hasBackupEmail) {
      console.log('No session, but using backup cookies for:', userEmail)
      
      // For API routes, allow the API to decide if it accepts the backup auth
      if (isProtectedApi) {
        return NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        })
      }
      
      // For protected pages, allow access with backup cookies
      return res
    }
    
    // If we reach here, no authentication was found
    console.log('Unauthenticated access to', path)
    
    // For API routes, return unauthorized
    if (isProtectedApi) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // For pages, redirect to sign in
    const redirectUrl = new URL('/', request.url)
    redirectUrl.searchParams.set('redirectedFrom', path)
    return NextResponse.redirect(redirectUrl)
    
  } catch (error) {
    console.error('Middleware error:', error)
    
    // On error, allow requests to continue but mark as unauthenticated
    requestHeaders.set('x-auth-error', 'true')
    
    // For API routes, return error
    if (isProtectedApi) {
      return NextResponse.json(
        { error: 'Authentication error', message: 'Failed to validate authentication' },
        { status: 500 }
      )
    }
    
    // For client routes, redirect to sign in
    if (isProtectedPage) {
      const redirectUrl = new URL('/', request.url)
      return NextResponse.redirect(redirectUrl)
    }
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
} 