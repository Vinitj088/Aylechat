import { NextRequest, NextResponse } from 'next/server';
import { deleteAllUserMemories } from '../../services/agentMemory.enhanced';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    // Delete all memories for the user
    await deleteAllUserMemories(userId);

    return NextResponse.json({ success: true, message: 'Memories cleared successfully' });
  } catch (error) {
    console.error('Error in clear-memories route:', error);
    return NextResponse.json(
      { error: 'Failed to clear memories' },
      { status: 500 }
    );
  }
}
