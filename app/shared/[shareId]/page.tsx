'use client';

import { useState, useEffect } from 'react';
import { Message, Model } from '../../types';
import Header from '../../component/Header';
import ChatMessages from '../../component/ChatMessages';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChatThread } from '@/lib/redis';

export default function SharedThreadPage({ params }: { params: { shareId: string } }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const router = useRouter();
  const { shareId } = params;

  useEffect(() => {
    async function fetchSharedThread() {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`/api/shared/${shareId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          setThread(data.thread);
          setMessages(data.thread.messages || []);
        } else {
          setError(data.error || 'Failed to load shared conversation');
        }
      } catch (err: any) {
        console.error('Error fetching shared thread:', err);
        setError('Failed to load shared conversation. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
    
    if (shareId) {
      fetchSharedThread();
    }
  }, [shareId]);

  // Render loading state
  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col">
        <Header toggleSidebar={() => {}} />
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--brand-default)]"></div>
            <div className="text-gray-600 font-medium">Loading shared conversation...</div>
          </div>
        </div>
      </main>
    );
  }

  // Render error state
  if (error || !thread) {
    return (
      <main className="flex min-h-screen flex-col">
        <Header toggleSidebar={() => {}} />
        <div className="flex flex-col items-center justify-center h-screen p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-red-600 mb-4">Error Loading Shared Conversation</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">{error || 'This shared conversation could not be found or has been removed.'}</p>
            <Button asChild>
              <Link href="/">Return to Home</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Get model information
  const selectedModelObj = {
    id: thread.model || 'exa',
    name: thread.model || 'Exa Search',
    provider: '',
    providerId: '',
    enabled: true,
    toolCallType: 'manual'
  };

  return (
    <main className="flex min-h-screen flex-col">
      <Header toggleSidebar={() => {}} />
      
      <div className="pt-16 pb-32 w-full overflow-x-hidden">
        <div className="w-full max-w-full md:max-w-4xl mx-auto px-4 py-6">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-medium mb-2">{thread.title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This is a shared conversation. You are viewing it in read-only mode.
            </p>
            <div className="mt-4 flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/">Start a New Chat</Link>
              </Button>
            </div>
          </div>
        </div>
        
        <ChatMessages 
          messages={messages} 
          isLoading={false} 
          selectedModel={thread.model || 'exa'}
          selectedModelObj={selectedModelObj}
          isExa={thread.model === 'exa'}
        />
      </div>
    </main>
  );
} 