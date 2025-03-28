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
}

export interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
  model?: string;
  createdAt: string;
  updatedAt: string;
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
} 