import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cache } from 'react';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Use cache() to deduplicate requests and improve performance
export const createServerComponentClient = cache(() => {
  const cookieStore = cookies();
  
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // This can happen in route handlers when the response is already sent
            console.error('Error setting cookie in server component:', error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options, maxAge: 0 });
          } catch (error) {
            console.error('Error removing cookie in server component:', error);
          }
        },
      },
    }
  );
});

// For route handlers (API routes)
export const createAPIRouteClient = () => {
  const cookieStore = cookies();
  
  // Check for debug cookie
  const userId = cookieStore.get('app-user-id')?.value;
  if (userId) {
    console.log('Found debug user ID cookie:', userId);
  }
  
  return createRouteHandlerClient({ 
    cookies: () => cookieStore,
  });
};

// For middleware
export const createMiddlewareClient = async (request: any, response: any) => {
  const { createMiddlewareClient } = await import('@supabase/auth-helpers-nextjs');
  return createMiddlewareClient({ req: request, res: response });
}; 