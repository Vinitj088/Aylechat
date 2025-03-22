import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const { data: { user }, error } = await supabase.auth.getUser();

  // Check for auth issues, but be more selective about clearing cookies
  if (error) {
    // Only log the error instead of clearing cookies automatically
    console.log('Auth error in middleware:', error.message);
    
    // Only clear cookies if it's a specific error that indicates corrupt cookies
    // This prevents clearing valid session cookies that just happen to time out
    if (error.message && (
        error.message.includes('invalid format') || 
        error.message.includes('parse error') ||
        error.message.includes('JWT') ||
        error.message.includes('malformed')
      )) {
      const authCookies = request.cookies.getAll().filter(c => 
        c.name.includes('supabase') || c.name.includes('sb-') || c.name.includes('auth')
      );
      
      if (authCookies.length > 0) {
        console.log('Detected corrupt auth cookies, clearing for clean state');
        for (const cookie of authCookies) {
          response.cookies.set({
            name: cookie.name,
            value: '',
            expires: new Date(0),
            path: '/',
          });
        }
      }
    }
  }

  // Optional: Log some debugging info
  console.log('Middleware: hasUser:', !!user);

  return response;
} 