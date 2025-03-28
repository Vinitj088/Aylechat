import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to check authentication status
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  
  try {
    // Use getUser to revalidate the token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Error getting user:', userError.message);
      return NextResponse.json(
        { 
          authenticated: false,
          error: userError.message
        },
        { 
          status: 401,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          }
        }
      );
    }
    
    if (!user) {
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
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          user_metadata: user.user_metadata
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