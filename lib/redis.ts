import { Redis } from '@upstash/redis'

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('Redis credentials are not properly configured')
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Helper functions for chat history
export async function getUserChats(userId: string) {
  const chats = await redis.get(`user:${userId}:chats`)
  return chats ? JSON.parse(chats as string) : []
}

export async function saveUserChat(userId: string, chat: any) {
  const chats = await getUserChats(userId)
  chats.unshift(chat)
  await redis.set(`user:${userId}:chats`, JSON.stringify(chats))
  return chats
}

export async function clearUserChats(userId: string) {
  await redis.del(`user:${userId}:chats`)
  return []
} 