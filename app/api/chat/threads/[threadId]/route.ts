import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/lib/db';
import { id } from '@instantdb/react';

export const dynamic = 'force-dynamic';

// Define the route context type
type RouteContext = {
  params: {
    threadId: string
  }
};

// GET a specific thread
export async function GET(
  req: NextRequest,
  context: { params: { threadId: string } }
) {
  try {
    const { threadId } = context.params;
    
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
    
    // Client will fetch data using useQuery. This endpoint is likely not needed.
    return NextResponse.json({
      success: true,
      thread: null
    });
    
  } catch (error: any) {
    console.error('Error getting thread:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to get thread' 
    }, { status: 500 });
  }
}

// PUT/UPDATE a specific thread
export async function PUT(
  req: NextRequest,
  context: { params: { threadId: string } }
) {
  try {
    const { threadId } = context.params;
    
    if (!threadId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Thread ID is required' 
      }, { status: 400 });
    }
    
    // Parse request body
    const body = await req.json();
    const { messages, title, model } = body;
    
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
    
    const now = new Date();
    const messageIds = messages.map(() => id());

    const transactions = [
      db.tx.threads[threadId]
        .update({
          title,
          model,
          updatedAt: now.toISOString(),
        }),
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

    const updatedThread = {
      id: threadId,
      title,
      messages,
      model,
      updatedAt: now.toISOString(),
    };
    
    return NextResponse.json({
      success: true,
      thread: updatedThread
    });
    
  } catch (error: any) {
    console.error('Error updating thread:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to update thread' 
    }, { status: 500 });
  }
}

// DELETE a specific thread
export async function DELETE(
  req: NextRequest,
  context: { params: { threadId: string } }
) {
  try {
    const { threadId } = context.params;
    
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
    
    await db.transact(db.tx.threads[threadId].delete());
    
    return NextResponse.json({
      success: true,
      message: 'Thread deleted successfully'
    });
    
  } catch (error: any) {
    console.error('Error deleting thread:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to delete thread' 
    }, { status: 500 });
  }
}
 