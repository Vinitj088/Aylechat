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
  '/api/migration'
];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  // Create Supabase client for auth
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });
  
  // Get the Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  
  // Skip auth check for public API routes
  if (publicApiRoutes.some(route => pathname.startsWith(route))) {
    return res;
  }
  
  // Check for protected routes that require authentication
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  if (isProtectedRoute) {
    // If no session, redirect to home
    if (!session) {
      const url = new URL('/?authRequired=true', request.url);
      return NextResponse.redirect(url);
    }
  }
  
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
} 