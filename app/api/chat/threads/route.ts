import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { InstantDBService } from '@/lib/instantdb';

export const dynamic = 'force-dynamic';

// GET endpoint to list all threads for a user
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: error?.message || 'Authentication required', authRequired: true },
        { status: 401 }
      );
    }
    const userId = user.id;
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const withMessages = searchParams.get('withMessages') === 'true';
    const limit = limitParam ? Math.max(1, Math.min(50, parseInt(limitParam))) : 10;
    let threads;
    if (withMessages) {
      threads = await InstantDBService.getLatestUserChatThreadsWithMessages(userId, limit);
     } else {
       threads = await InstantDBService.getUserChatThreads(userId);
    }
    return NextResponse.json({ success: true, threads: threads || [] });
   } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to get threads' }, { status: 500 });
   }
}

// POST endpoint to create a new thread
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, title, model = 'exa' } = body;
    if (!messages || !Array.isArray(messages)) {
       return NextResponse.json({ success: false, error: 'Messages are required and must be an array' }, { status: 400 });
    }
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: error?.message || 'Authentication required', authRequired: true },
         { status: 401 }
      );
    }
    const userId = user.id;
    const threadTitle = title || (messages[0]?.content.substring(0, 50) + '...') || 'New Chat';
    const thread = await InstantDBService.createChatThread(userId, threadTitle, messages, model);
     if (!thread) {
       return NextResponse.json({ success: false, error: 'Failed to create thread' }, { status: 500 });
    }
    return NextResponse.json({ success: true, thread });
   } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to create thread' }, { status: 500 });
   }
}

// DELETE endpoint to clear all threads for a user
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: error?.message || 'Authentication required', authRequired: true },
         { status: 401 }
      );
    }
    const userId = user.id;
    const deleteCount = await InstantDBService.deleteAllUserChatThreads(userId);  
     return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deleteCount} chat threads.`,
      deletedCount: deleteCount
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to delete threads', message: error.message || 'An internal server error occurred' }, { status: 500 });
   }
} 