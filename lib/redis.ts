import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Verify Redis connection
export async function verifyRedisConnection() {
  try {
    await redis.ping();
    console.log('Redis connection verified successfully');
    return true;
  } catch (error) {
    console.error('Redis connection failed:', error);
    return false;
  }
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
  completed?: boolean;
  images?: any[];
  attachments?: any[];
  startTime?: number;
  endTime?: number;
  tps?: number;
}

export interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
  model?: string;
  createdAt: string;
  updatedAt: string;
  isPublic?: boolean;
  shareId?: string;
}

export class RedisService {
  // Get all chat threads for a user
  static async getUserChatThreads(userId: string): Promise<ChatThread[]> {
    try {
      const threads = await redis.lrange(`user:${userId}:threads`, 0, -1);
      return threads.map(thread => {
        // Check if thread is already an object
        if (typeof thread === 'object') {
          return thread as ChatThread;
        }
        // If it's a string, try to parse it
        try {
          return JSON.parse(thread as string);
        } catch (e) {
          console.error('Error parsing thread:', e);
          return null;
        }
      }).filter((thread): thread is ChatThread => thread !== null);
    } catch (error) {
      console.error('Error getting user chat threads:', error);
      return [];
    }
  }

  // Get a specific chat thread
  static async getChatThread(userId: string, threadId: string): Promise<ChatThread | null> {
    try {
      const thread = await redis.get(`thread:${userId}:${threadId}`);
      if (!thread) return null;
      
      // Check if thread is already an object
      if (typeof thread === 'object') {
        return thread as ChatThread;
      }
      
      // If it's a string, try to parse it
      try {
        return JSON.parse(thread as string);
      } catch (e) {
        console.error('Error parsing thread:', e);
        return null;
      }
    } catch (error) {
      console.error('Error getting chat thread:', error);
      return null;
    }
  }

  // Create a new chat thread
  static async createChatThread(userId: string, title: string, messages: any[], model: string = 'exa'): Promise<ChatThread | null> {
    try {
      const threadId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      const thread: ChatThread = {
        id: threadId,
        title,
        messages,
        model,
        createdAt: now,
        updatedAt: now,
      };
      
      // Store the thread
      await redis.set(`thread:${userId}:${threadId}`, JSON.stringify(thread));
      
      // Add to user's thread list
      await redis.lpush(`user:${userId}:threads`, JSON.stringify(thread));
      
      return thread;
    } catch (error) {
      console.error('Error creating chat thread:', error);
      return null;
    }
  }

  // Update a chat thread
  static async updateChatThread(userId: string, threadId: string, updates: Partial<ChatThread>): Promise<ChatThread | null> {
    try {
      const threadKey = `thread:${userId}:${threadId}`;
      const exists = await redis.exists(threadKey);
      if (!exists) return null;
      
      // Get current thread data
      const threadData = await redis.get(threadKey);
      if (!threadData) return null;
      
      // Ensure threadData is a string before parsing
      const stringData = typeof threadData === 'string' ? threadData : JSON.stringify(threadData);
      const thread = JSON.parse(stringData) as ChatThread;
      const now = new Date().toISOString();
      
      // Update thread
      const updatedThread = {
        ...thread,
        ...updates,
        updatedAt: now
      };
      
      // Ensure proper serialization before saving
      await redis.set(threadKey, JSON.stringify(updatedThread));
      
      // Update thread in user's thread list
      const threads = await this.getUserChatThreads(userId);
      const threadIndex = threads.findIndex(t => t.id === threadId);
      
      if (threadIndex !== -1) {
        const threadSummary = {
          id: threadId,
          title: updatedThread.title || thread.title,
          updatedAt: now
        };
        
        // Use lset to update the thread at its index
        await redis.lset(`user:${userId}:threads`, threadIndex, JSON.stringify(threadSummary));
      }
      
      return updatedThread;
    } catch (error) {
      console.error('Error updating chat thread:', error);
      return null;
    }
  }

  // Make a thread shareable by generating a shareId and setting isPublic to true
  static async makeThreadShareable(userId: string, threadId: string): Promise<{ shareId: string; thread: ChatThread } | null> {
    try {
      const threadKey = `thread:${userId}:${threadId}`;
      const exists = await redis.exists(threadKey);
      if (!exists) return null;
      
      // Get current thread data
      const threadData = await redis.get(threadKey);
      if (!threadData) return null;
      
      // Ensure threadData is a string before parsing
      const stringData = typeof threadData === 'string' ? threadData : JSON.stringify(threadData);
      const thread = JSON.parse(stringData) as ChatThread;
      
      // If thread is already shared, just return the existing shareId and thread
      if (thread.isPublic && thread.shareId) {
        console.log(`Thread ${threadId} is already shared with ID: ${thread.shareId}`);
        return { shareId: thread.shareId, thread };
      }
      
      // Generate a shareId if not already present
      const shareId = thread.shareId || crypto.randomUUID();
      
      // Update thread with isPublic flag and shareId
      const updatedThread = {
        ...thread,
        isPublic: true,
        shareId,
        updatedAt: new Date().toISOString()
      };
      
      // Save the updated thread
      await redis.set(threadKey, JSON.stringify(updatedThread));
      
      // Store a reference to this thread in a shared threads index for quick lookup
      await redis.set(`shared:${shareId}`, `${userId}:${threadId}`);
      
      return { shareId, thread: updatedThread };
    } catch (error) {
      console.error('Error making thread shareable:', error);
      return null;
    }
  }

  // Get a shared thread by its shareId (public access)
  static async getSharedThread(shareId: string): Promise<ChatThread | null> {
    try {
      // Get the userId:threadId reference
      const threadRef = await redis.get(`shared:${shareId}`);
      if (!threadRef || typeof threadRef !== 'string') return null;
      
      // Split into userId and threadId
      const [userId, threadId] = threadRef.split(':');
      if (!userId || !threadId) return null;
      
      // Get the thread
      const thread = await this.getChatThread(userId, threadId);
      if (!thread || !thread.isPublic) return null;
      
      return thread;
    } catch (error) {
      console.error('Error getting shared thread:', error);
      return null;
    }
  }

  // Delete a chat thread
  static async deleteChatThread(userId: string, threadId: string): Promise<boolean> {
    try {
      const threadKey = `thread:${userId}:${threadId}`;
      const exists = await redis.exists(threadKey);
      if (!exists) {
        console.log(`Thread ${threadId} not found for user ${userId}`);
        return false;
      }

      // Delete thread data
      await redis.del(threadKey);
      
      // Find the thread in the user's threads list
      const userThreadsKey = `user:${userId}:threads`;
      const threads = await redis.lrange(userThreadsKey, 0, -1);
      
      // Find the index of the thread
      let threadIndex = -1;
      for (let i = 0; i < threads.length; i++) {
        try {
          const threadData = typeof threads[i] === 'string' 
            ? JSON.parse(threads[i]) 
            : threads[i];
          
          if (threadData.id === threadId) {
            threadIndex = i;
            break;
          }
        } catch (e) {
          console.error('Error parsing thread data:', e);
        }
      }
      
      if (threadIndex !== -1) {
        // Remove just this thread from the list
        const placeholder = JSON.stringify({ id: 'deleted', title: 'deleted' });
        await redis.lset(userThreadsKey, threadIndex, placeholder);
        await redis.lrem(userThreadsKey, 1, placeholder);
      } else {
        console.log(`Thread ${threadId} not found in user's thread list`);
      }

      return true;
    } catch (error) {
      console.error('Error deleting chat thread:', error);
      return false;
    }
  }

  // Delete ALL chat threads for a user
  static async deleteAllUserChatThreads(userId: string): Promise<number> {
    const userThreadsKey = `user:${userId}:threads`;
    let deletedCount = 0;

    try {
      // Get all thread summaries/references from the user's list
      const threadSummaries = await redis.lrange(userThreadsKey, 0, -1);
      
      if (threadSummaries.length === 0) {
        console.log(`No threads found to delete for user ${userId}.`);
        return 0;
      }

      const keysToDelete: string[] = [userThreadsKey]; // Start with the list key itself

      // Collect all individual thread keys
      for (const summary of threadSummaries) {
        try {
          // Attempt to parse the summary to get the ID
          let threadId: string | undefined;
          if (typeof summary === 'object' && summary !== null && 'id' in summary) {
             threadId = (summary as { id: string }).id;
          } else if (typeof summary === 'string') {
             const parsedSummary = JSON.parse(summary);
             threadId = parsedSummary.id;
          }
          
          if (threadId) {
            keysToDelete.push(`thread:${userId}:${threadId}`);
          } else {
             console.warn(`Could not extract threadId from summary for user ${userId}:`, summary);
          }
        } catch (parseError) {
          console.error(`Error parsing thread summary for user ${userId}:`, summary, parseError);
          // Optionally, try to delete based on a pattern if parsing fails, but safer to skip
        }
      }

      // Perform the deletion
      if (keysToDelete.length > 1) { // More than just the list key
        const delResult = await redis.del(...keysToDelete);
        // The count returned by del is the total number of keys removed.
        // We subtract 1 because one key is the list itself.
        deletedCount = delResult - 1;
        console.log(`Deleted ${deletedCount} threads and the list key for user ${userId}.`);
      } else if (keysToDelete.length === 1) {
         // Only the list key exists (potentially empty or corrupted summaries)
         await redis.del(userThreadsKey);
         console.log(`Deleted only the list key ${userThreadsKey} as no valid thread keys were found.`);
      }

      return deletedCount;

    } catch (error) {
      console.error(`Error deleting all chat threads for user ${userId}:`, error);
      // Depending on the error, some keys might have been deleted.
      // Returning 0 as a safe default, but might need more robust error handling.
      return 0;
    }
  }
} 