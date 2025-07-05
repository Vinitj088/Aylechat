import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { InstantDBService } from '@/lib/instantdb';

export const dynamic = 'force-dynamic';

// Define the route context type
type RouteContext = {
  params: Promise<{
    threadId: string
  }>
};

// POST endpoint to share a thread
export async function POST(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const { threadId } = await context.params;
    
    if (!threadId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Thread ID is required' 
      }, { status: 400 });
    }
    
    // Get user from Supabase auth
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    // Check if we have a valid user
    if (error || !user) {
      console.error('Auth error:', error?.message || 'No user found');
      return NextResponse.json(
        { 
          error: 'Unauthorized', 
          message: error?.message || 'Authentication required',
          authRequired: true 
        },
        { status: 401 }
      );
    }
    
    const userId = user.id;
    
    // Make the thread shareable
    const result = await InstantDBService.makeThreadShareable(userId, threadId);
    
    if (!result) {
      return NextResponse.json({ success: false, error: 'Failed to make thread shareable' }, { status: 500 });
    }
    
    // Return the shareId and full URL for sharing
    const shareUrl = `${req.nextUrl.origin}/shared/${result.shareId}`;
    
    return NextResponse.json({ success: true, shareId: result.shareId, thread: result });
    
  } catch (error: any) {
    console.error('Error sharing thread:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to make thread shareable' 
    }, { status: 500 });
  }
} 