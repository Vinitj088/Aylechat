import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('Session API: Starting session check');
    
    // Get all cookies for debugging
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    console.log('Session API: Available cookies:', allCookies.map(c => c.name).join(', '));
    
    // Use getToken to verify the session without accessing the database
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // Add strict cache control headers to prevent caching
    const headers = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
      'Vary': '*'
    };

    // If no token or id, return unauthorized
    if (!token || !token.id) {
      console.log('Session API: No valid token found, returning 401');
      return NextResponse.json(
        { user: null },
        { 
          status: 401,
          headers
        }
      );
    }

    console.log(`Session API: Valid token found for user ${token.id}`);
    
    // Current date plus 30 days
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);

    return NextResponse.json(
      {
        user: {
          id: token.id,
          name: token.name,
          email: token.email,
        },
        expires: expires.toISOString()
      },
      { headers }
    );
  } catch (error) {
    console.error('Error in custom session route:', error);
    return NextResponse.json(
      { user: null },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store',
          'Vary': '*'
        }
      }
    );
  }
} 