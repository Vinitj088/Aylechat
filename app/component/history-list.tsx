'use client'

import { getChats } from '@/lib/actions/chat'
import { Chat } from '@/lib/types'
import { useEffect, useState } from 'react'
import { ClearHistory } from './clear-history'
import HistoryItem from './history-item'

type HistoryListProps = {
  userId?: string
}

export function HistoryList({ userId }: HistoryListProps) {
  const [chats, setChats] = useState<Chat[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadChats() {
      if (!userId) {
        setChats([])
        setIsLoading(false)
        return
      }

      try {
        const loadedChats = await getChats(userId)
        setChats(loadedChats || [])
      } catch (error) {
        console.error('Failed to load chats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadChats()
  }, [userId])

  if (isLoading) {
    return null // Let Suspense handle loading state
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pb-2 pt-0">
        {!chats?.length ? (
          <div className="text-foreground/30 text-sm text-center py-4">
            No search history
          </div>
        ) : (
          <div className="space-y-2 pt-3">
            {chats?.map(
              (chat: Chat) => chat && <HistoryItem key={chat.id} chat={chat} />
            )}
          </div>
        )}
      </div>
      <div className="pt-2 pb-2">
        <ClearHistory empty={!chats?.length} />
      </div>
    </div>
  )
}
