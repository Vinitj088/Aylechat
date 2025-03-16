'use server'

import { authOptions } from '@/lib/auth'
import { getRedisClient, RedisWrapper } from '@/lib/redis/config'
import { type Chat } from '@/lib/types'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'

async function getRedis(): Promise<RedisWrapper> {
  return await getRedisClient()
}

const CHAT_VERSION = 'v2'
function getUserChatKey(userId: string) {
  return `user:${CHAT_VERSION}:chat:${userId}`
}

export async function getChats(userId?: string | null) {
  if (!userId) {
    return []
  }

  let redis: RedisWrapper
  try {
    redis = await getRedis()
  } catch (error) {
    console.error('Failed to connect to Redis:', error)
    throw new Error('Failed to connect to Redis')
  }

  try {
    const chats = await redis.zrange(getUserChatKey(userId), 0, -1, {
      rev: true
    })

    if (chats.length === 0) {
      return []
    }

    const results = await Promise.all(
      chats.map(async chatKey => {
        const chat = await redis.hgetall(chatKey)
        return chat
      })
    )

    return results
      .filter((result): result is Record<string, any> => {
        if (result === null || Object.keys(result).length === 0) {
          return false
        }
        return true
      })
      .map(chat => {
        const plainChat = { ...chat }
        if (typeof plainChat.messages === 'string') {
          try {
            plainChat.messages = JSON.parse(plainChat.messages)
          } catch (error) {
            plainChat.messages = []
          }
        }
        if (plainChat.createdAt && !(plainChat.createdAt instanceof Date)) {
          plainChat.createdAt = new Date(plainChat.createdAt)
        }
        return plainChat as Chat
      })
  } catch (error) {
    console.error('Failed to fetch chats from Redis:', error)
    throw new Error('Failed to fetch chat history')
  }
}

export async function getChat(id: string, userId?: string) {
  const session = await getServerSession()
  const authenticatedUserId = session?.user?.id || userId
  if (!authenticatedUserId) {
    return null
  }

  const redis = await getRedis()
  const chat = await redis.hgetall<Chat>(`chat:${id}`)

  if (!chat) {
    return null
  }

  // Check if the chat belongs to the user
  if (chat.userId !== authenticatedUserId) {
    return null
  }

  // Parse the messages if they're stored as a string
  if (typeof chat.messages === 'string') {
    try {
      chat.messages = JSON.parse(chat.messages)
    } catch (error) {
      chat.messages = []
    }
  }

  // Ensure messages is always an array
  if (!Array.isArray(chat.messages)) {
    chat.messages = []
  }

  return chat
}

export async function clearChats(userId?: string): Promise<{ error?: string }> {
  try {
    const session = await getServerSession(authOptions)
    const authenticatedUserId = session?.user?.id || userId
    
    if (!authenticatedUserId) {
      return { error: 'Unauthorized' }
    }

    const redis = await getRedis()
    const userChatKey = getUserChatKey(authenticatedUserId)
    const chats = await redis.zrange(userChatKey, 0, -1)
    
    if (!chats.length) {
      return { error: 'No chats to clear' }
    }
    
    const pipeline = redis.pipeline()

    // Delete each chat and its reference in the sorted set
    for (const chat of chats) {
      pipeline.del(chat)
    }
    // Clear the user's chat list
    pipeline.del(userChatKey)

    await pipeline.exec()
    
    revalidatePath('/')
    return {}  // Success case returns empty object
  } catch (error) {
    console.error('Error clearing chats:', error)
    return { error: 'Failed to clear chat history' }
  }
}

export async function saveChat(chat: Chat, userId?: string) {
  const session = await getServerSession(authOptions)
  const authenticatedUserId = session?.user?.id || userId

  if (!authenticatedUserId) {
    console.warn('Attempted to save chat without authentication')
    return null
  }

  try {
    const redis = await getRedis()
    const pipeline = redis.pipeline()

    const chatToSave = {
      ...chat,
      userId: authenticatedUserId,
      messages: JSON.stringify(chat.messages),
      updatedAt: new Date().toISOString()
    }

    // Check if this chat thread already exists
    const existingChat = await redis.hgetall(`chat:${chat.id}`)
    
    // If it's a new chat, add it to the sorted set
    if (!existingChat || Object.keys(existingChat).length === 0) {
      pipeline.zadd(getUserChatKey(authenticatedUserId), Date.now(), `chat:${chat.id}`)
    }

    // Update the chat content
    pipeline.hmset(`chat:${chat.id}`, chatToSave)

    const results = await pipeline.exec()
    revalidatePath('/')
    return results
  } catch (error) {
    console.error('Failed to save chat:', error)
    return null
  }
}

export async function getSharedChat(id: string) {
  const redis = await getRedis()
  const chat = await redis.hgetall<Chat>(`chat:${id}`)

  if (!chat || !chat.sharePath) {
    return null
  }

  return chat
}

export async function shareChat(id: string, userId?: string) {
  const session = await getServerSession()
  const authenticatedUserId = session?.user?.id || userId
  if (!authenticatedUserId) {
    return null
  }

  const redis = await getRedis()
  const chat = await redis.hgetall<Chat>(`chat:${id}`)

  if (!chat || chat.userId !== authenticatedUserId) {
    return null
  }

  const payload = {
    ...chat,
    sharePath: `/share/${id}`
  }

  await redis.hmset(`chat:${id}`, payload)

  return payload
}
