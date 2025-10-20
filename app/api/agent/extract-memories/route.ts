import { NextRequest, NextResponse } from 'next/server';
import { extractMemories } from '../../services/agentMemory.enhanced';
import { Message } from '../../../types';

export async function POST(request: NextRequest) {
  try {
    const { messages, userId } = await request.json();

    if (!messages || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: messages, userId' },
        { status: 400 }
      );
    }

    // Extract and store memories
    await extractMemories(messages as Message[], userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in extract-memories route:', error);
    return NextResponse.json(
      { error: 'Failed to extract memories' },
      { status: 500 }
    );
  }
}
