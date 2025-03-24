'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChatThread } from '@/lib/redis';
import { useAuth } from '@/context/AuthContext';
import { useThreadCache } from '@/context/ThreadCacheContext';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { getAssetPath } from '../utils';
import { X, Trash2, LogOut, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSignInClick?: () => void;
  refreshTrigger?: number;
}

export default function Sidebar({ isOpen, onClose, onSignInClick, refreshTrigger = 0 }: SidebarProps) {
  const [lastRefreshTrigger, setLastRefreshTrigger] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut, refreshSession, openAuthDialog } = useAuth();
  // Use the thread cache context for thread data and operations
  const { threads, isLoading, fetchThreads, removeThread, lastUpdated } = useThreadCache();

  const isAuthenticated = !!user;

  // Fetch when refreshTrigger changes, this indicates thread operations (create/update/delete)
  useEffect(() => {
    if (isAuthenticated && user && isOpen) {
      if (lastRefreshTrigger !== refreshTrigger) {
        setLastRefreshTrigger(refreshTrigger);
        // Force refresh on trigger change as it means data has changed
        fetchThreads(true);
      }
    }
  }, [refreshTrigger, isAuthenticated, user, isOpen, lastRefreshTrigger, fetchThreads]);

  // When sidebar opens, check if we should refresh based on the last update time
  useEffect(() => {
    if (isOpen && isAuthenticated && user) {
      // Try to fetch threads when sidebar opens, the context will handle caching
      fetchThreads(false);
    }
  }, [isOpen, isAuthenticated, user, fetchThreads]);

  const handleThreadClick = (threadId: string) => {
    router.push(`/chat/${threadId}`);
    onClose();
  };

  const handleDeleteThread = async (threadId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this chat thread?')) {
      return;
    }
    
    try {
      const response = await fetch(getAssetPath(`/api/chat/threads/${threadId}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      });
      
      if (response.ok) {
        // Use the context's removeThread function to update cache
        removeThread(threadId);
        
        // If we're currently viewing this thread, redirect to home
        if (pathname === `/chat/${threadId}`) {
          router.push('/');
        }
        
        toast.success('Thread deleted successfully');
      } else {
        const errorData = await response.json();
        toast.error('Failed to delete thread', {
          description: errorData.message || 'Please try again later',
        });
      }
    } catch (error) {
      console.error('Error deleting thread:', error);
      toast.error('Failed to delete thread', {
        description: 'Please check your connection and try again',
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
      onClose();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
      {/* Overlay - only visible when sidebar is open */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/40 dark:bg-black/60 z-40 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div 
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-64 bg-gradient-to-b from-[var(--secondary-faint)] to-[var(--secondary-fainter)] border-l border-[var(--secondary-darkest)] shadow-lg transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Sidebar content */}
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--secondary-darkest)] bg-[var(--secondary-default)] flex items-center justify-between">
            <h2 className="text-base font-medium text-[var(--text-light-default)] flex items-center">
              <Clock className="h-4 w-4 mr-2 text-[var(--brand-default)]" />
              Chat History
            </h2>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[var(--secondary-darker)] text-[var(--text-light-muted)] hover:text-[var(--text-light-default)] transition-colors"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {!isAuthenticated ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <p className="text-sm text-[var(--text-light-muted)]">Sign in to view your chat history</p>
                <button
                  onClick={onSignInClick || openAuthDialog}
                  className="px-4 py-2 text-sm font-medium bg-[var(--brand-default)] text-white rounded-md hover:bg-[var(--brand-muted)] shadow-sm transition-all hover:shadow"
                >
                  Sign In
                </button>
              </div>
            ) : isLoading ? (
              <div className="flex justify-center items-center h-24">
                {/* Pulsing dots loading indicator */}
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-[var(--brand-default)] animate-[bounce_1s_infinite]"></div>
                  <div className="w-2 h-2 bg-[var(--brand-default)] animate-[bounce_1s_infinite_200ms]"></div>
                  <div className="w-2 h-2 bg-[var(--brand-default)] animate-[bounce_1s_infinite_400ms]"></div>
                </div>
              </div>
            ) : fetchError ? (
              <div className="text-center py-4 px-3 bg-[var(--accent-maroon-light)] border border-[var(--accent-maroon-dark)] rounded-md">
                <p className="text-[var(--accent-red)] text-sm">{fetchError}</p>
                <button
                  onClick={() => fetchThreads()}
                  className="mt-2 px-3 py-1.5 bg-[var(--secondary-darker)] text-[var(--text-light-default)] rounded-md text-sm hover:bg-[var(--secondary-darkest)] transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-6 px-3 bg-[var(--secondary-fainter)] rounded-md border border-dashed border-[var(--secondary-darker)]">
                <p className="text-[var(--text-light-muted)] text-sm">No chat history yet</p>
                <p className="text-xs text-[var(--text-light-faint)] mt-1">Start a new chat to see your history here</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <button
                      onClick={() => handleThreadClick(thread.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-md border transition-all duration-200",
                        pathname === `/chat/${thread.id}` 
                          ? "bg-[var(--brand-fainter)] border-[var(--brand-muted)] shadow-[0_0_0_1px_var(--brand-faint)]" 
                          : "border-[var(--secondary-darkest)] hover:bg-[var(--secondary-darker)] hover:border-[var(--secondary-darkest)]"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-medium truncate pr-2 text-sm text-[var(--text-light-default)]">
                          {thread.title}
                        </div>
                        <button
                          onClick={(e) => handleDeleteThread(thread.id, e)}
                          className="p-1 text-[var(--text-light-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--accent-maroon-light)] rounded-full transition-colors"
                          title="Delete thread"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="text-xs text-[var(--text-light-muted)] mt-1.5 flex items-center">
                        <Clock className="h-3 w-3 mr-1 inline-block text-[var(--brand-faint)]" />
                        {formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })}
                      </div>
                    </button>
                  </li>
                ))}
                <li className="text-center mt-4 pt-3 border-t border-dashed border-[var(--secondary-darker)]">
                  <span className="text-xs text-[var(--text-light-muted)] italic">— End of history —</span>
                </li>
              </ul>
            )}
          </div>
          
          {/* Footer with user info and sign out */}
          {isAuthenticated && user && (
            <div className="p-3 border-t border-[var(--secondary-darkest)] bg-gradient-to-b from-[var(--secondary-faint)] to-[var(--secondary-default)]">
              <div className="flex justify-between items-center">
                <div className="text-sm truncate flex items-center text-[var(--text-light-default)]">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--brand-fainter)] text-[var(--brand-default)] mr-2">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <span className="font-medium">{user.user_metadata?.name || user.email}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-2 py-1.5 text-[var(--text-light-muted)] hover:text-[var(--text-light-default)] hover:bg-[var(--secondary-darker)] rounded-md flex items-center gap-1.5 text-xs transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 