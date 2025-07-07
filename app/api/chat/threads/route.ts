import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/lib/db';
import { id } from '@instantdb/react';

export const dynamic = 'force-dynamic';

// GET endpoint to list all threads for a user
export async function GET(req: NextRequest) {
  try {
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
    console.log(`Fetching threads for user: ${userId}`);

    // InstantDB does not require manual fetching on the backend.
    // The client will use db.useQuery to get real-time updates.
    // This endpoint can be simplified or removed if all data fetching is on the client.
    // For now, we'll return an empty array as the client will handle it.

    return NextResponse.json({
      success: true,
      threads: []
    });
    
  } catch (error: any) {
    console.error('Error getting threads:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to get threads' 
    }, { status: 500 });
  }
}

// POST endpoint to create a new thread
export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const body = await req.json();
    const { messages, title, model = 'exa' } = body;
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Messages are required and must be an array' 
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
    
    // Generate title if not provided
    const threadTitle = title || (messages[0]?.content.substring(0, 50) + '...') || 'New Chat';
    
    const threadId = id();
    const now = new Date();
    const messageIds = messages.map(() => id());

    const transactions = [
      db.tx.threads[threadId]
        .update({
          title: threadTitle,
          model,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          isPublic: false,
        })
        .link({ user: userId, messages: messageIds }),
      ...messages.map((message, i) => 
        db.tx.messages[messageIds[i]]
          .update({
            role: message.role,
            content: message.content,
            createdAt: now.toISOString(),
          })
          .link({ thread: threadId })
      )
    ];

    await db.transact(transactions);
    
    const thread = {
      id: threadId,
      title: threadTitle,
      messages,
      model,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return NextResponse.json({
      success: true,
      thread
    });
    
  } catch (error: any) {
    console.error('Error creating thread:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to create thread' 
    }, { status: 500 });
  }
}

// DELETE endpoint to clear all threads for a user
export async function DELETE(req: NextRequest) {
  try {
    // Get user from Supabase auth
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    // Check if we have a valid user
    if (error || !user) {
      console.error('Auth error on DELETE /threads:', error?.message || 'No user found');
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
    console.log(`Attempting to delete all threads for user: ${userId}`);
    
    // This is a placeholder. In a real app, you'd fetch the user's threads
    // and then create a transaction to delete each one.
    // Since the client will be responsible for this, we'll leave this as a no-op for now.
    const deleteCount = 0;
    
    console.log(`Deleted ${deleteCount} threads for user: ${userId}`);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deleteCount} chat threads.`,
      deletedCount: deleteCount
    });
    
  } catch (error: any) {
    console.error('Error deleting all threads:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete threads', 
      message: error.message || 'An internal server error occurred' 
    }, { status: 500 });
  }
}
 