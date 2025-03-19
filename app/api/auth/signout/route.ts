import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to handle signing out and cleaning up cookies
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  
  try {
    // Sign out
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    
    if (error) {
      console.error('Error signing out:', error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    // Return success
    return NextResponse.json(
      { success: true },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }
      }
    );
  } catch (error: any) {
    console.error('Unhandled error in sign out:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 