import { NextRequest, NextResponse } from 'next/server';
import { RedisService } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// Define the route context type
type RouteContext = {
  params: Promise<{
    shareId: string
  }>
};

// GET a shared thread
export async function GET(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const { shareId } = await context.params;
    
    if (!shareId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Share ID is required' 
      }, { status: 400 });
    }
    
    // Get the shared thread from Redis
    const thread = await RedisService.getSharedThread(shareId);
    
    if (!thread) {
      return NextResponse.json({ 
        success: false, 
        error: 'Shared thread not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      thread
    });
    
  } catch (error: any) {
    console.error('Error getting shared thread:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to get shared thread' 
    }, { status: 500 });
  }
} 