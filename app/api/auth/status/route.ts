import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to check authentication status
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  
  try {
    // Get the session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error.message);
      return NextResponse.json(
        { 
          authenticated: false,
          error: error.message
        },
        { 
          status: 401,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          }
        }
      );
    }
    
    if (!session) {
      return NextResponse.json(
        { authenticated: false },
        { 
          status: 200,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          }
        }
      );
    }
    
    // Return user info (excluding sensitive data)
    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: session.user.id,
          email: session.user.email,
          created_at: session.user.created_at,
          user_metadata: session.user.user_metadata
        }
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
      }
    );
  } catch (error: any) {
    console.error('Unhandled error in auth status:', error);
    
    return NextResponse.json(
      { 
        authenticated: false,
        error: 'Internal server error'
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
      }
    );
  }
} 