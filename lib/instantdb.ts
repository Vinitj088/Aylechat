import { init, id } from '@instantdb/react';
import schema from '../instant.schema';

export const db = init({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
  schema,
});

export class InstantDBService {
  // Get all chat threads for a user (server-side)
  static async getUserChatThreads(userId: string) {
    const result = await db.transact({
      threads: { $: { where: { userId } } }
    });
    return result.threads || [];
  }

  // Get a specific chat thread (server-side)
  static async getChatThread(userId: string, threadId: string) {
    const result = await db.transact({
      threads: { $: { where: { id: threadId, userId } } }
    });
    return result.threads?.[0] || null;
  }

  // Create a new chat thread (server-side)
  static async createChatThread(userId: string, title: string, messages: any[], model: string = 'exa') {
    const threadId = id();
    const now = new Date().toISOString();
    try {
      await db.transact([
        db.tx.threads[threadId].update({
          id: threadId,
          userId,
          title,
          model,
          createdAt: now,
          updatedAt: now,
        }),
        ...messages.map((msg) => {
          const msgId = msg.id || id();
          return db.tx.messages[msgId].update({
            ...msg,
            id: msgId,
            threadId,
            createdAt: msg.createdAt || now,
          });
        }),
      ]);
    } catch (err) {
      console.error('Error creating thread in InstantDB:', err);
      return null;
    }
    // Query for the thread should be done via db.useQuery or in the API route
    return threadId;
  }

  // Update a chat thread (server-side)
  static async updateChatThread(userId: string, threadId: string, updates: any) {
    const now = new Date().toISOString();
    await db.transact([
      db.tx.threads[threadId].update({
        ...updates,
        updatedAt: now,
      }),
      ...(updates.messages
        ? updates.messages.map((msg: any) => {
            const msgId = msg.id || id();
            return db.tx.messages[msgId].update({
              ...msg,
              id: msgId,
              threadId,
              createdAt: msg.createdAt || now,
            });
          })
        : []),
    ]);
    // Query for the thread should be done via db.useQuery or in the API route
    return threadId;
  }

  // Make a thread shareable (server-side)
  static async makeThreadShareable(userId: string, threadId: string) {
    const shareId = id();
    await db.transact([
      db.tx.threads[threadId].update({
        isPublic: true,
        shareId,
        updatedAt: new Date().toISOString(),
      })
    ]);
    return shareId;
  }

  // Get a shared thread by shareId (server-side)
  static async getSharedThread(shareId: string) {
    const result = await db.transact({
      threads: { $: { where: { shareId, isPublic: true } } }
    });
    return result.threads?.[0] || null;
  }

  // Delete a chat thread (server-side)
  static async deleteChatThread(userId: string, threadId: string) {
    await db.transact([
      db.tx.threads[threadId].delete()
    ]);
    // Delete all messages for this thread
    // Query for messages should be done via db.useQuery or in the API route
    return true;
  }

  // Delete all chat threads for a user (server-side)
  static async deleteAllUserChatThreads(userId: string, threadIds: string[]) {
    // threadIds must be provided by the caller (queried via db.useQuery)
    for (const threadId of threadIds) {
      await this.deleteChatThread(userId, threadId);
    }
    return threadIds.length;
  }

  // Get the latest N chat threads for a user, including messages (server-side)
  static async getLatestUserChatThreadsWithMessages(userId: string, limit: number) {
    const result = await db.transact({
      threads: { $: { where: { userId } } }
    });
    let sortedThreads = result.threads || [];
    sortedThreads = sortedThreads.sort((a: any, b: any) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, limit);
    for (const thread of sortedThreads) {
      const msgResult = await db.transact({
        messages: { $: { where: { threadId: thread.id } } }
      });
      (thread as any).messages = msgResult.messages || [];
    }
    return sortedThreads;
  }
} 