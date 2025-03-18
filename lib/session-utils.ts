import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Auth cookies that need to be cleared for proper logout
 */
export const AUTH_COOKIE_NAMES = [
  // NextAuth cookies with various prefixes
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  '__Host-next-auth.session-token',
  'next-auth.csrf-token',
  '__Secure-next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
  '__Host-next-auth.callback-url',
  // Other session cookies
  'session_token'
];

/**
 * Clear auth cookies in a server action
 * This must be called from a function marked with 'use server'
 */
export async function clearAuthCookiesServerAction() {
  try {
    const cookieStore = cookies();
    
    for (const name of AUTH_COOKIE_NAMES) {
      // Delete with default options
      cookieStore.delete(name);
      
      // Also try with explicit path
      cookieStore.delete({
        name,
        path: '/',
      });
    }
    return true;
  } catch (error) {
    console.error('Error clearing auth cookies in server action:', error);
    return false;
  }
}

/**
 * Clear auth cookies in a route handler and add cookie clearing headers to response
 * @param response NextResponse object to add cookie headers to
 */
export function clearAuthCookiesInResponse(response: NextResponse) {
  try {
    const cookieStore = cookies();
    
    for (const name of AUTH_COOKIE_NAMES) {
      // Clear in cookie store
      try {
        cookieStore.delete(name);
      } catch (e) {
        console.error(`Error deleting cookie ${name} from store:`, e);
      }
      
      // Clear in response
      try {
        // Simple delete
        response.cookies.delete(name);
        
        // Set expired cookie
        response.cookies.set({
          name,
          value: '',
          expires: new Date(0),
          path: '/',
        });
        
        // Also try secure and http-only variants
        response.cookies.set({
          name,
          value: '',
          expires: new Date(0),
          path: '/',
          secure: true,
          httpOnly: true
        });
      } catch (e) {
        console.error(`Error clearing cookie ${name} in response:`, e);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error clearing auth cookies in response:', error);
    return false;
  }
} 