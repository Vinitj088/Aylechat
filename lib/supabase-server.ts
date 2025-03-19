import { createServerComponentClient, createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { cache } from 'react';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Creates a Supabase client for Server Components
 */
export const createServerClient = cache(() => {
  const cookieStore = cookies();
  return createServerComponentClient({
    cookies: () => cookieStore,
  });
});

/**
 * Creates a Supabase client for Route Handlers
 */
export const createAPIRouteClient = (cookieStore = cookies()) => {
  return createRouteHandlerClient({
    cookies: () => cookieStore,
  });
};

/**
 * Gets the current session from a server component
 */
export async function getServerSession() {
  const supabase = createServerClient();
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    return data.session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

// For middleware
export const createMiddlewareClient = async (request: any, response: any) => {
  const { createMiddlewareClient } = await import('@supabase/auth-helpers-nextjs');
  return createMiddlewareClient({ req: request, res: response });
}; 