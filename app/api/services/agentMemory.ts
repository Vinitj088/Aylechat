import { Message } from '../../types';

// --- Agent Memory Service ---
// Long-term memory with semantic retrieval and user preferences

export type MemoryEntry = {
  id: string;
  type: 'fact' | 'preference' | 'task_result' | 'decision';
  content: string;
  embedding?: number[]; // Vector embedding for semantic search
  metadata: {
    threadId?: string;
    timestamp: Date;
    importance: number; // 0-1 score
    accessCount: number;
    lastAccessed: Date;
  };
  tags: string[];
};

export type UserPreference = {
  id: string;
  category: 'communication' | 'tools' | 'format' | 'behavior';
  preference: string;
  examples: string[];
  confidence: number; // How sure we are about this preference
  updatedAt: Date;
};

// In-memory store (should be persisted to database in production)
const memoryStore = new Map<string, MemoryEntry>();
const preferenceStore = new Map<string, UserPreference>();

/**
 * Extracts and stores important information from conversation
 * @param messages - Recent conversation
 * @param userId - User identifier
 */
export async function extractMemories(
  messages: Message[],
  userId: string
): Promise<void> {
  // Only analyze if there's meaningful conversation
  if (messages.length < 2) return;

  const conversationText = messages
    .slice(-5)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const extractionPrompt = `Analyze this conversation and extract:
1. Important facts or information mentioned
2. User preferences (how they like things done)
3. Key decisions made
4. Task results or outcomes

Conversation:
${conversationText}

Respond with JSON:
{
  "memories": [
    {
      "type": "fact",
      "content": "User is working on a Next.js project",
      "importance": 0.7,
      "tags": ["project", "nextjs", "web-development"]
    },
    {
      "type": "preference",
      "content": "User prefers TypeScript over JavaScript",
      "importance": 0.8,
      "tags": ["preference", "typescript", "coding-style"]
    }
  ]
}

Only extract genuinely important information. Skip small talk.`;

  try {
    const response = await fetch('/api/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: extractionPrompt,
        model: 'llama-3.3-70b-versatile',
        systemPrompt: 'You are an expert at identifying and extracting important information from conversations.',
        stream: false,
        temperature: 0.1,
      }),
    });

    if (!response.ok) return;

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) return;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const data = JSON.parse(jsonMatch[0]);

    // Store memories
    for (const memory of data.memories || []) {
      const entry: MemoryEntry = {
        id: `memory-${userId}-${Date.now()}-${Math.random()}`,
        type: memory.type,
        content: memory.content,
        metadata: {
          timestamp: new Date(),
          importance: memory.importance || 0.5,
          accessCount: 0,
          lastAccessed: new Date(),
        },
        tags: memory.tags || [],
      };

      memoryStore.set(entry.id, entry);

      // If it's a preference, update preference store
      if (memory.type === 'preference') {
        updateUserPreference(userId, memory);
      }
    }

    console.log(`Stored ${data.memories?.length || 0} memories for user ${userId}`);
  } catch (error) {
    console.error('Error extracting memories:', error);
  }
}

/**
 * Retrieves relevant memories for current context
 * @param query - Current user query
 * @param userId - User identifier
 * @returns Relevant memory entries
 */
export function retrieveRelevantMemories(
  query: string,
  userId: string,
  limit: number = 5
): MemoryEntry[] {
  const queryLower = query.toLowerCase();
  const queryWords = new Set(queryLower.split(/\s+/));

  // Score memories by relevance
  const scoredMemories = Array.from(memoryStore.values())
    .map(memory => {
      // Simple keyword matching (in production, use vector embeddings)
      const contentWords = new Set(memory.content.toLowerCase().split(/\s+/));
      const tagWords = new Set(memory.tags.map(t => t.toLowerCase()));

      const contentOverlap = [...queryWords].filter(w => contentWords.has(w)).length;
      const tagOverlap = [...queryWords].filter(w => tagWords.has(w)).length;

      const relevanceScore =
        (contentOverlap / queryWords.size) * 0.6 +
        (tagOverlap / queryWords.size) * 0.4;

      const recencyScore = 1 - (Date.now() - memory.metadata.timestamp.getTime()) / (30 * 24 * 60 * 60 * 1000); // Decay over 30 days

      const totalScore =
        relevanceScore * 0.5 +
        memory.metadata.importance * 0.3 +
        Math.max(0, recencyScore) * 0.2;

      return { memory, score: totalScore };
    })
    .filter(item => item.score > 0.1) // Minimum relevance threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Update access metadata
  scoredMemories.forEach(({ memory }) => {
    memory.metadata.accessCount++;
    memory.metadata.lastAccessed = new Date();
  });

  return scoredMemories.map(item => item.memory);
}

/**
 * Updates user preference based on observed behavior
 */
function updateUserPreference(userId: string, memoryData: any): void {
  const prefKey = `${userId}-${memoryData.tags?.[0] || 'general'}`;

  const existing = preferenceStore.get(prefKey);

  if (existing) {
    // Update existing preference
    existing.examples.push(memoryData.content);
    existing.confidence = Math.min(1, existing.confidence + 0.1);
    existing.updatedAt = new Date();
  } else {
    // Create new preference
    const pref: UserPreference = {
      id: prefKey,
      category: inferCategory(memoryData.tags),
      preference: memoryData.content,
      examples: [memoryData.content],
      confidence: 0.6,
      updatedAt: new Date(),
    };

    preferenceStore.set(prefKey, pref);
  }
}

/**
 * Gets user preferences for context enhancement
 */
export function getUserPreferences(userId: string): UserPreference[] {
  return Array.from(preferenceStore.values())
    .filter(pref => pref.id.startsWith(userId))
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Enriches query with relevant context from memory
 * @param query - Original user query
 * @param userId - User identifier
 * @returns Enhanced query with context
 */
export function enrichQueryWithMemory(
  query: string,
  userId: string
): { enrichedQuery: string; memories: MemoryEntry[] } {
  const relevantMemories = retrieveRelevantMemories(query, userId, 3);

  if (relevantMemories.length === 0) {
    return { enrichedQuery: query, memories: [] };
  }

  const contextBlock = relevantMemories
    .map(m => `- ${m.content}`)
    .join('\n');

  const enrichedQuery = `${query}

[Context from previous conversations]:
${contextBlock}`;

  return { enrichedQuery, memories: relevantMemories };
}

/**
 * Cleans up old, low-importance memories
 */
export function cleanupMemories(maxAge: number = 90 * 24 * 60 * 60 * 1000): void {
  const now = Date.now();

  for (const [id, memory] of memoryStore.entries()) {
    const age = now - memory.metadata.timestamp.getTime();

    // Remove if old AND (low importance OR never accessed)
    if (
      age > maxAge &&
      (memory.metadata.importance < 0.3 || memory.metadata.accessCount === 0)
    ) {
      memoryStore.delete(id);
    }
  }

  console.log(`Memory cleanup complete. ${memoryStore.size} memories retained.`);
}

// Helper functions
function inferCategory(tags: string[]): UserPreference['category'] {
  const tagStr = tags.join(' ').toLowerCase();

  if (tagStr.includes('format') || tagStr.includes('style')) return 'format';
  if (tagStr.includes('tool')) return 'tools';
  if (tagStr.includes('communication') || tagStr.includes('tone')) return 'communication';

  return 'behavior';
}

// Export stores for persistence
export function exportMemories(): any {
  return {
    memories: Array.from(memoryStore.entries()),
    preferences: Array.from(preferenceStore.entries()),
  };
}

export function importMemories(data: any): void {
  if (data.memories) {
    data.memories.forEach(([key, value]: [string, MemoryEntry]) => {
      memoryStore.set(key, value);
    });
  }

  if (data.preferences) {
    data.preferences.forEach(([key, value]: [string, UserPreference]) => {
      preferenceStore.set(key, value);
    });
  }
}
