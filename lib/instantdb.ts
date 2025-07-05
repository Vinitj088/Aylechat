import { init, lookup } from '@instantdb/admin';
import schema from '../instant.schema';

const db = init({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
  adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
  schema,
});

export class InstantDBService {
  // Get all chat threads for a user
  static async getUserChatThreads(userId: string) {
    const data = await db.query({
      threads: { $: { where: { userId } } },
    });
    return data.threads || [];
  }

  // Get a specific chat thread
  static async getChatThread(userId: string, threadId: string) {
    const data = await db.query({
      threads: { $: { where: { id: threadId, userId } } },
    });
    return data.threads?.[0] || null;
  }

  // Create a new chat thread
  static async createChatThread(userId: string, title: string, messages: any[], model: string = 'exa') {
    const threadId = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await db.transact(
        db.tx.threads[threadId].update({
          id: threadId,
          userId,
          title,
          model,
          createdAt: now,
          updatedAt: now,
        })
      );
    } catch (err) {
      console.error('Error creating thread in InstantDB:', err);
      return null;
    }
    // Save messages
    const txs = [];
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        throw new Error('Each message must have a role and content');
      }
      const msgId = msg.id || crypto.randomUUID();
      const allowedFields = [
        'id', 'role', 'content', 'citations', 'completed', 'images',
        'attachments', 'startTime', 'endTime', 'tps', 'createdAt'
      ];
      const cleanMsg: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key === 'id') cleanMsg.id = msgId;
        else if (msg[key] !== undefined) cleanMsg[key] = msg[key];
      }
      if (!cleanMsg.createdAt) cleanMsg.createdAt = now;
      cleanMsg.threadId = threadId;
      console.log('Saving message to InstantDB:', cleanMsg);
      txs.push(
        db.tx.messages[msgId]
          .update(cleanMsg)
          .link({ thread: threadId })
      );
    }
    if (txs.length) {
      try {
        await db.transact(txs);
      } catch (err) {
        if (err && typeof err === 'object' && 'body' in err) {
          console.error('Error saving messages to InstantDB:', err, 'body:', JSON.stringify(err.body, null, 2));
        } else {
          console.error('Error saving messages to InstantDB:', err);
        }
        return null;
      }
    }
    return this.getChatThread(userId, threadId);
  }

  // Update a chat thread
  static async updateChatThread(userId: string, threadId: string, updates: any) {
    const now = new Date().toISOString();
    await db.transact(
      db.tx.threads[threadId].update({
        ...updates,
        updatedAt: now,
      })
    );
    if (updates.messages) {
      // Remove old messages for this thread
      const data = await db.query({
        messages: { $: { where: { threadId } } },
      });
      for (const msg of data.messages || []) {
        await db.transact(db.tx.messages[msg.id].delete());
      }
      // Add new messages
      const allowedFields = [
        'id', 'role', 'content', 'citations', 'completed', 'images',
        'attachments', 'startTime', 'endTime', 'tps', 'createdAt'
      ];
      const txs = [];
      for (const msg of updates.messages) {
        if (!msg.role || !msg.content) {
          throw new Error('Each message must have a role and content');
        }
        const msgId = msg.id || crypto.randomUUID();
        const cleanMsg: Record<string, any> = {};
        for (const key of allowedFields) {
          if (key === 'id') cleanMsg.id = msgId;
          else if (msg[key] !== undefined) cleanMsg[key] = msg[key];
        }
        if (!cleanMsg.createdAt) cleanMsg.createdAt = now;
        cleanMsg.threadId = threadId;
        console.log('Saving message to InstantDB:', cleanMsg);
        txs.push(
          db.tx.messages[msgId]
            .update(cleanMsg)
            .link({ thread: threadId })
        );
      }
      if (txs.length) {
        await db.transact(txs);
      }
    }
    return this.getChatThread(userId, threadId);
  }

  // Make a thread shareable
  static async makeThreadShareable(userId: string, threadId: string) {
    const shareId = crypto.randomUUID();
    await db.transact(
      db.tx.threads[threadId].update({
        isPublic: true,
        shareId,
        updatedAt: new Date().toISOString(),
      })
    );
    return this.getChatThread(userId, threadId);
  }

  // Get a shared thread by shareId
  static async getSharedThread(shareId: string) {
    const data = await db.query({
      threads: { $: { where: { shareId, isPublic: true } } },
    });
    return data.threads?.[0] || null;
  }

  // Delete a chat thread
  static async deleteChatThread(userId: string, threadId: string) {
    await db.transact(db.tx.threads[threadId].delete());
    // Delete all messages for this thread
    const data = await db.query({
      messages: { $: { where: { threadId } } },
    });
    for (const msg of data.messages || []) {
      await db.transact(db.tx.messages[msg.id].delete());
    }
    return true;
  }

  // Delete all chat threads for a user
  static async deleteAllUserChatThreads(userId: string) {
    const data = await db.query({
      threads: { $: { where: { userId } } },
    });
    let deletedCount = 0;
    for (const thread of data.threads || []) {
      await this.deleteChatThread(userId, thread.id);
      deletedCount++;
    }
    return deletedCount;
  }

  // Get the latest N chat threads for a user, including messages
  static async getLatestUserChatThreadsWithMessages(userId: string, limit: number) {
    const data = await db.query({
      threads: { $: { where: { userId } } },
    });
    let threads = data.threads || [];
    threads = threads.sort((a: any, b: any) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, limit);
    for (const thread of threads) {
      const msgData = await db.query({
        messages: { $: { where: { threadId: thread.id } } },
      });
      (thread as any).messages = msgData.messages || [];
    }
    return threads;
  }
} 