import { Message } from '../../types';
import { getOrCreateIndex, generateEmbedding } from '../../../lib/pinecone';
import { callGroqAPI } from '../../../lib/groqClient';

// --- Enhanced Agent Memory Service with Pinecone Vector Search ---

export type MemoryEntry = {
  id: string;
  type: 'fact' | 'preference' | 'task_result' | 'decision';
  content: string;
  embedding?: number[];
  metadata: {
    threadId?: string;
    timestamp: Date;
    importance: number;
    accessCount: number;
    lastAccessed: Date;
    userId: string;
  };
  tags: string[];
};

export type UserPreference = {
  id: string;
  category: 'communication' | 'tools' | 'format' | 'behavior';
  preference: string;
  examples: string[];
  confidence: number;
  updatedAt: Date;
};

/**
 * Enhanced memory extraction with Pinecone storage
 */
export async function extractMemories(
  messages: Message[],
  userId: string
): Promise<void> {
  if (messages.length < 2) {
    console.log('⏭️ Skipping extraction: less than 2 messages');
    return;
  }

  const conversationText = messages
    .slice(-5)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  console.log(`🔍 Extracting memories from ${messages.length} messages (last 5):`, conversationText.substring(0, 200) + '...');

  const extractionPrompt = `Analyze this conversation and extract important information.

Conversation:
${conversationText}

Extract:
1. Important facts or information mentioned by the USER (not general knowledge from assistant)
2. User preferences (how they like things done)
3. Key decisions made by the USER
4. Task results or outcomes

IMPORTANT: Respond with ONLY valid JSON, no markdown, no explanations. Use this exact format:

{
  "memories": [
    {
      "type": "fact",
      "content": "User is working on a Next.js project with TypeScript",
      "importance": 0.8,
      "tags": ["project", "nextjs", "typescript", "web-development"]
    },
    {
      "type": "preference",
      "content": "User prefers detailed code examples with comments",
      "importance": 0.7,
      "tags": ["preference", "code-style", "documentation"]
    }
  ]
}

If no important user-specific information to extract, return: {"memories": []}

Only extract genuinely important information about the USER. Skip general knowledge and small talk.`;

  try {
    const result = await callGroqAPI({
      query: extractionPrompt,
      model: 'llama-3.3-70b-versatile',
      systemPrompt: 'You are a JSON-only API that extracts important user information from conversations. Return ONLY valid JSON with no markdown formatting or explanations.',
      stream: false,
      temperature: 0.1,
    });

    if (!result) {
      console.log('❌ No result from Groq API');
      return;
    }

    const content = result.choices[0]?.message?.content;

    if (!content) {
      console.log('❌ No content in Groq response');
      return;
    }

    console.log('📝 Raw extraction response:', content.substring(0, 300));

    // Try to extract JSON - handle both raw JSON and markdown code blocks
    let jsonText = content;

    // Remove markdown code blocks if present
    const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }

    // Extract JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('❌ No JSON found in response');
      return;
    }

    const data = JSON.parse(jsonMatch[0]);
    console.log('📊 Parsed data:', JSON.stringify(data, null, 2));

    // Store memories in Pinecone
    const index = await getOrCreateIndex();

    for (const memory of data.memories || []) {
      const memoryId = `${userId}-${Date.now()}-${Math.random()}`;

      // Generate embedding for semantic search
      const embedding = await generateEmbedding(memory.content);

      if (embedding && index) {
        // Store in Pinecone
        await index.upsert([
          {
            id: memoryId,
            values: embedding,
            metadata: {
              userId,
              type: memory.type,
              content: memory.content,
              importance: memory.importance || 0.5,
              tags: JSON.stringify(memory.tags || []),
              timestamp: Date.now(),
              accessCount: 0,
            },
          },
        ]);

        console.log(`Stored memory in Pinecone: ${memoryId}`);
      }
    }

    console.log(`Extracted and stored ${data.memories?.length || 0} memories for user ${userId}`);
  } catch (error) {
    console.error('Error extracting memories:', error);
  }
}

/**
 * Retrieve relevant memories using vector similarity search
 */
export async function retrieveRelevantMemories(
  query: string,
  userId: string,
  limit: number = 5
): Promise<MemoryEntry[]> {
  try {
    const index = await getOrCreateIndex();
    if (!index) {
      console.warn('Pinecone not available, using fallback');
      return [];
    }

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) {
      return [];
    }

    // Search for similar memories
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: limit,
      filter: { userId: { $eq: userId } },
      includeMetadata: true,
    });

    console.log(`🔍 Found ${searchResults.matches?.length || 0} potential matches`);
    searchResults.matches?.forEach(match => {
      console.log(`  - Score: ${match.score?.toFixed(3)} | ${(match.metadata?.content as string)?.substring(0, 60)}`);
    });

    // Convert to MemoryEntry format
    const memories: MemoryEntry[] = searchResults.matches
      ?.filter(match => {
        const score = match.score || 0;
        const isRelevant = score > 0.35; // Threshold for Google AI embeddings (padded from 768d)
        if (!isRelevant) {
          console.log(`  ⏭️ Skipped (score ${score.toFixed(3)} < 0.35): ${(match.metadata?.content as string)?.substring(0, 60)}`);
        }
        return isRelevant;
      }) // Only include relevant matches
      .map(match => ({
        id: match.id,
        type: (match.metadata?.type as MemoryEntry['type']) || 'fact',
        content: (match.metadata?.content as string) || '',
        metadata: {
          userId: (match.metadata?.userId as string) || userId,
          timestamp: new Date(Number(match.metadata?.timestamp) || Date.now()),
          importance: Number(match.metadata?.importance) || 0.5,
          accessCount: Number(match.metadata?.accessCount) || 0,
          lastAccessed: new Date(),
          threadId: match.metadata?.threadId as string,
        },
        tags: JSON.parse((match.metadata?.tags as string) || '[]'),
        embedding: undefined, // Don't return embedding
      })) || [];

    // Note: We skip updating access count because Pinecone requires full embedding vectors for upsert
    // This would require fetching the original embeddings, which adds latency
    // Access count tracking can be implemented with a separate database if needed

    console.log(`Retrieved ${memories.length} relevant memories for query: "${query}"`);
    return memories;
  } catch (error) {
    console.error('Error retrieving memories:', error);
    return [];
  }
}

/**
 * Enriches query with relevant context from memory
 */
export async function enrichQueryWithMemory(
  query: string,
  userId: string
): Promise<{ enrichedQuery: string; memories: MemoryEntry[] }> {
  const relevantMemories = await retrieveRelevantMemories(query, userId, 3);

  if (relevantMemories.length === 0) {
    return { enrichedQuery: query, memories: [] };
  }

  const contextBlock = relevantMemories
    .map(m => `- ${m.content}`)
    .join('\n');

  const enrichedQuery = `${query}

[Remembered context]:
${contextBlock}`;

  return { enrichedQuery, memories: relevantMemories };
}

/**
 * Delete all memories for a user (useful for re-indexing with new embeddings)
 */
export async function deleteAllUserMemories(userId: string): Promise<void> {
  try {
    const index = await getOrCreateIndex();
    if (!index) return;

    // Query all user memories
    const allMemories = await index.query({
      vector: new Array(1536).fill(0), // Dummy vector
      topK: 10000,
      filter: { userId: { $eq: userId } },
      includeMetadata: true,
    });

    const idsToDelete = allMemories.matches?.map(m => m.id) || [];

    if (idsToDelete.length > 0) {
      await index.deleteMany(idsToDelete);
      console.log(`🗑️ Deleted ${idsToDelete.length} memories for user ${userId}`);
    }
  } catch (error) {
    console.error('Error deleting memories:', error);
  }
}

/**
 * Cleans up old, low-importance memories from Pinecone
 */
export async function cleanupMemories(
  userId: string,
  maxAge: number = 90 * 24 * 60 * 60 * 1000
): Promise<void> {
  try {
    const index = await getOrCreateIndex();
    if (!index) return;

    const now = Date.now();
    const cutoffTime = now - maxAge;

    // Query all user memories
    const allMemories = await index.query({
      vector: new Array(1536).fill(0), // Dummy vector
      topK: 10000,
      filter: { userId: { $eq: userId } },
      includeMetadata: true,
    });

    const toDelete: string[] = [];

    allMemories.matches?.forEach(match => {
      const timestamp = Number(match.metadata?.timestamp) || 0;
      const importance = Number(match.metadata?.importance) || 0;
      const accessCount = Number(match.metadata?.accessCount) || 0;

      // Remove if old AND (low importance OR never accessed)
      if (timestamp < cutoffTime && (importance < 0.3 || accessCount === 0)) {
        toDelete.push(match.id);
      }
    });

    if (toDelete.length > 0) {
      await index.deleteMany(toDelete);
      console.log(`Cleaned up ${toDelete.length} old memories for user ${userId}`);
    }
  } catch (error) {
    console.error('Error cleaning up memories:', error);
  }
}

/**
 * Get user's stored preferences
 */
export async function getUserPreferences(userId: string): Promise<UserPreference[]> {
  const memories = await retrieveRelevantMemories('user preferences and settings', userId, 10);

  return memories
    .filter(m => m.type === 'preference')
    .map(m => ({
      id: m.id,
      category: inferCategory(m.tags),
      preference: m.content,
      examples: [m.content],
      confidence: m.metadata.importance,
      updatedAt: m.metadata.lastAccessed,
    }));
}

// Helper function
function inferCategory(tags: string[]): UserPreference['category'] {
  const tagStr = tags.join(' ').toLowerCase();

  if (tagStr.includes('format') || tagStr.includes('style')) return 'format';
  if (tagStr.includes('tool')) return 'tools';
  if (tagStr.includes('communication') || tagStr.includes('tone')) return 'communication';

  return 'behavior';
}
