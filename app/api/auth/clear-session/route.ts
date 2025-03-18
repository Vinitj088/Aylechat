import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('CLEAR-SESSION: Forcefully clearing all auth cookies');
  
  // Access the cookie store
  const cookieStore = cookies();
  
  // List of all possible auth-related cookies to clear
  const cookiesToClear = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    '__Host-next-auth.session-token',
    'next-auth.csrf-token',
    '__Secure-next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
    '__Host-next-auth.callback-url',
    'session_token'
  ];
  
  // Log all existing cookies for debugging
  const allCookies = cookieStore.getAll();
  console.log('CLEAR-SESSION: Found cookies:', allCookies.map(c => c.name).join(', '));
  
  // Delete all auth cookies with various settings
  for (const name of cookiesToClear) {
    console.log(`CLEAR-SESSION: Attempting to delete cookie: ${name}`);
    
    // Method 1: Simple delete
    cookieStore.delete(name);
    
    // Method 2: Set with expires in the past
    cookieStore.set({
      name,
      value: '',
      expires: new Date(0),
      path: '/',
    });
    
    // Method 3: Also try with secure flag
    cookieStore.set({
      name,
      value: '',
      expires: new Date(0),
      path: '/',
      secure: true,
    });
    
    // Method 4: Try different paths
    cookieStore.set({
      name,
      value: '',
      expires: new Date(0),
      path: '/api',
    });
    
    cookieStore.set({
      name,
      value: '',
      expires: new Date(0),
      path: '/api/auth',
    });
  }
  
  // Create response with appropriate headers
  const response = NextResponse.json({ 
    success: true, 
    message: 'All auth cookies have been cleared',
    timestamp: new Date().toISOString()
  });
  
  // Also set headers in the response
  for (const name of cookiesToClear) {
    response.cookies.delete(name);
    
    response.cookies.set({
      name,
      value: '',
      expires: new Date(0),
      path: '/',
    });
  }
  
  // Set cache control headers
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

export async function POST(request: NextRequest) {
  // Reuse the GET implementation
  return GET(request);
} 