import { NextRequest, NextResponse } from 'next/server';
import { enrichQueryWithMemory } from '../../services/agentMemory.enhanced';

export async function POST(request: NextRequest) {
  try {
    const { query, userId } = await request.json();

    if (!query || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: query, userId' },
        { status: 400 }
      );
    }

    // Enrich query with relevant memories
    const result = await enrichQueryWithMemory(query, userId);

    return NextResponse.json({
      enrichedQuery: result.enrichedQuery,
      memories: result.memories,
    });
  } catch (error) {
    console.error('Error in enrich-query route:', error);
    return NextResponse.json(
      { error: 'Failed to enrich query' },
      { status: 500 }
    );
  }
}
