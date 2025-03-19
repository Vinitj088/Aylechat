'use client';

import { useAuth } from '@/context/AuthContext';
import ChatThreadsList from '@/components/ChatThreadsList';
import SignOutButton from '@/components/SignOutButton';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

export default function ChatPage() {
  const { user, isLoading, openAuthDialog } = useAuth();
  
  // Open auth dialog if user is not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      openAuthDialog();
    }
  }, [isLoading, user, openAuthDialog]);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8 pb-4 border-b">
        <h1 className="text-3xl font-bold">Chat Threads</h1>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-gray-600">{user.email}</span>
              <SignOutButton />
            </>
          ) : (
            <Button onClick={openAuthDialog} size="sm">Sign In</Button>
          )}
        </div>
      </div>
      
      <div className="min-h-[500px]">
        <ChatThreadsList />
      </div>
    </div>
  );
} 