'use client';

import { Message } from '../../types';
import Header from '../../component/Header';
import ChatMessages from '../../component/ChatMessages';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import React from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { db } from '@/lib/db';

export default function SharedThreadPage() {
  const params = useParams() ?? {};
  const shareId = (params as Record<string, string>).shareId;

  const { data, isLoading, error } = db.useQuery({
    threads: {
      $: { where: { shareId: shareId } },
      messages: { $: { order: { createdAt: 'asc' } } }
    }
  });

  const thread = data?.threads?.[0];
  const messages = thread?.messages || [];

  // Render loading state
  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col">
        <div className="md:hidden">
          <Header />
        </div>
        <Link
          href="/"
          className="hidden md:flex fixed top-4 left-4 z-50 items-center transition-colors duration-200 hover:text-[#121212] dark:hover:text-[#ffffff]"
          onClick={e => {
            e.preventDefault();
            window.location.href = '/';
          }}
        >
          <span
            className="text-3xl text-[var(--brand-default)]"
            style={{
              fontFamily: 'var(--font-gebuk-regular)',
              letterSpacing: '0.05em',
              fontWeight: 'normal',
              position: 'relative',
              padding: '0 4px'
            }}
          >
            Ayle
          </span>
        </Link>
        <div className="flex-1 flex flex-col items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--brand-default)]"></div>
            <div className="text-gray-600 font-medium">Loading shared conversation...</div>
          </div>
        </div>
        <div className="hidden md:block fixed bottom-4 left-4 z-50">
          <ThemeToggle />
        </div>
      </main>
    );
  }

  // Render error state
  if (error || !thread) {
    return (
      <main className="flex min-h-screen flex-col">
        <div className="md:hidden">
          <Header />
        </div>
        <Link
          href="/"
          className="hidden md:flex fixed top-4 left-4 z-50 items-center transition-colors duration-200 hover:text-[#121212] dark:hover:text-[#ffffff]"
          onClick={e => {
            e.preventDefault();
            window.location.href = '/';
          }}
        >
          <span
            className="text-3xl text-[var(--brand-default)]"
            style={{
              fontFamily: 'var(--font-gebuk-regular)',
              letterSpacing: '0.05em',
              fontWeight: 'normal',
              position: 'relative',
              padding: '0 4px'
            }}
          >
            Ayle
          </span>
        </Link>
        <div className="flex flex-col items-center justify-center h-screen p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-red-600 mb-4">Error Loading Shared Conversation</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">{error?.message || 'This shared conversation could not be found or has been removed.'}</p>
            <Button asChild>
              <Link href="/">Return to Home</Link>
            </Button>
          </div>
        </div>
        <div className="hidden md:block fixed bottom-4 left-4 z-50">
          <ThemeToggle />
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
      <div className="md:hidden">
        <Header />
      </div>
      <Link
        href="/"
        className="hidden md:flex fixed top-4 left-4 z-50 items-center transition-colors duration-200 hover:text-[#121212] dark:hover:text-[#ffffff]"
        onClick={e => {
          e.preventDefault();
          window.location.href = '/';
        }}
      >
        <span
          className="text-3xl text-[var(--brand-default)]"
          style={{
            fontFamily: 'var(--font-gebuk-regular)',
            letterSpacing: '0.05em',
            fontWeight: 'normal',
            position: 'relative',
            padding: '0 4px'
          }}
        >
          Ayle
        </span>
      </Link>
      <div className="flex-1 flex flex-col">
        <div className="w-full max-w-full md:max-w-4xl mx-auto px-4 pt-20">
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
          messages={messages as Message[]}
          isLoading={false}
          selectedModel={thread.model || 'exa'}
          selectedModelObj={selectedModelObj}
          isExa={thread.model === 'exa'}
          currentThreadId={shareId}
          isSharedPage={true}
        />
      </div>
      <div className="hidden md:block fixed bottom-4 left-4 z-50">
        <ThemeToggle />
      </div>
    </main>
  );
}

 