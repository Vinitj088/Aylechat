import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Use getToken to verify the session without accessing the database
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // Add cache control headers to prevent caching
    const headers = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    if (!token) {
      return NextResponse.json(
        { user: null },
        { 
          status: 401,
          headers
        }
      );
    }

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
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
} 