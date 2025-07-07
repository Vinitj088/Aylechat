import { NextRequest, NextResponse } from 'next/server';
import { init, id } from '@instantdb/admin';
import schema from '@/instant.schema';

const db = init({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
  adminToken: process.env.INSTANTDB_ADMIN_TOKEN!,
  schema,
});

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
    
    // Fetch the thread
    const data = await db.query({
      threads: { $: { where: { id: threadId } } }
    });
    const thread = data.threads?.[0];
    if (!thread) {
      return NextResponse.json({ success: false, error: 'Thread not found' }, { status: 404 });
    }
    
    // Generate shareId if needed
    let shareId = thread.shareId;
    let isNewShare = false;
    if (!shareId) {
      shareId = id();
      isNewShare = true;
    }
    
    await db.transact([
      db.tx.threads[threadId].update({
        isPublic: true,
        shareId,
      })
    ]);
    
    // Return the shareId and full URL for sharing
    const shareUrl = `${req.nextUrl.origin}/shared/${shareId}`;
    
    return NextResponse.json({
      success: true,
      shareId,
      shareUrl,
      isNewShare
    });
    
  } catch (error: any) {
    console.error('Error sharing thread:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to share thread' 
    }, { status: 500 });
  }
} 