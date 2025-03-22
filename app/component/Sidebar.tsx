'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChatThread } from '@/lib/redis';
import { useAuth } from '@/context/AuthContext';
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
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastRefreshTrigger, setLastRefreshTrigger] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const isFetchingRef = useRef(false);
  const cachedThreadsRef = useRef<{
    timestamp: number;
    threadHash: string;
    threads: ChatThread[];
  } | null>(null);
  
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut, refreshSession, openAuthDialog } = useAuth();
  
  const isAuthenticated = !!user;

  // Load cached threads on mount
  useEffect(() => {
    if (isAuthenticated && user) {
      try {
        const cachedData = localStorage.getItem(`sidebar_threads_${user.id}`);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          if (parsed && parsed.threads && Array.isArray(parsed.threads)) {
            cachedThreadsRef.current = parsed;
            setThreads(parsed.threads);
          }
        }
      } catch (error) {
        console.error('Error loading cached threads:', error);
      }
    }
  }, [isAuthenticated, user]);

  // Helper function to update thread cache
  const updateThreadCache = useCallback((updatedThreads: ChatThread[]) => {
    if (!user) return;
    
    try {
      const threadIds = updatedThreads.map(t => t.id).join(',');
      const threadHash = btoa(threadIds);
      
      const cacheData = {
        timestamp: Date.now(),
        threadHash,
        threads: updatedThreads
      };
      
      cachedThreadsRef.current = cacheData;
      localStorage.setItem(`sidebar_threads_${user.id}`, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error updating thread cache:', error);
    }
  }, [user]);

  // Improved function to fetch threads with better error handling and caching
  const fetchThreads = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated || !user) {
      setThreads([]);
      setIsLoading(false);
      return;
    }

    // Skip fetch if we have recent cache (unless force refresh)
    const now = Date.now();
    if (!forceRefresh && 
        cachedThreadsRef.current && 
        now - cachedThreadsRef.current.timestamp < 60000) { // 1 minute cache
      setThreads(cachedThreadsRef.current.threads);
      return;
    }

    // Prevent concurrent fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    setIsLoading(true);
    try {
      const response = await fetch(getAssetPath('/api/chat/threads'), {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Ensure threads is always an array
        if (data.success && Array.isArray(data.threads)) {
          // Update state with threads
          const fetchedThreads = data.threads;
          setThreads(fetchedThreads);
          
          // Update the cache using our helper
          updateThreadCache(fetchedThreads);
        } else {
          console.error('Threads data is not in expected format:', data);
          setThreads([]);
        }
      } else if (response.status === 401) {
        console.error('Authentication failed when fetching threads');
        toast.error('Authentication issue detected', {
          description: 'Attempting to fix session...',
          duration: 3000,
        });
        
        // Try to fix the session
        try {
          await refreshSession();
          toast.success('Session fixed, retrying...');
          
          // Try fetching threads again after a short delay
          setTimeout(async () => {
            try {
              const retryResponse = await fetch(getAssetPath('/api/chat/threads'), {
                credentials: 'include',
                headers: {
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Pragma': 'no-cache',
                }
              });
              
              if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                // Ensure threads is always an array
                if (retryData.success && Array.isArray(retryData.threads)) {
                  const threads = retryData.threads;
                  setThreads(threads);
                  
                  // Update the cache using our helper
                  updateThreadCache(threads);
                } else {
                  console.error('Retry threads data is not in expected format:', retryData);
                  setThreads([]);
                }
              } else {
                setThreads([]);
              }
            } catch (retryError) {
              console.error('Error retrying thread fetch:', retryError);
              setThreads([]);
            } finally {
              setIsLoading(false);
              isFetchingRef.current = false;
            }
          }, 1000);
          return;
        } catch (refreshError) {
          console.error('Failed to refresh session:', refreshError);
          setThreads([]);
        }
      } else {
        console.error('Failed to fetch threads');
        setThreads([]);
      }
    } catch (error) {
      console.error('Error fetching threads:', error);
      setThreads([]);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [isAuthenticated, refreshSession, user, updateThreadCache]);

  // Fetch when refreshTrigger changes (when threads are updated)
  useEffect(() => {
    if (isAuthenticated && user && refreshTrigger > 0 && lastRefreshTrigger !== refreshTrigger) {
      setLastRefreshTrigger(refreshTrigger);
      fetchThreads(true); // Force refresh on trigger change
    }
  }, [refreshTrigger, isAuthenticated, user, lastRefreshTrigger, fetchThreads]);

  // Load cache when sidebar opens, but only fetch if cache is old or missing
  useEffect(() => {
    if (isOpen && isAuthenticated && user) {
      // Use cached data if available
      if (cachedThreadsRef.current) {
        setThreads(cachedThreadsRef.current.threads);
        
        // Check if cache is old (older than 5 minutes)
        const now = Date.now();
        if (now - cachedThreadsRef.current.timestamp > 5 * 60 * 1000) {
          fetchThreads(false); // Refresh in background if cache is old
        }
      } else {
        // No cache, we must fetch
        fetchThreads(true);
      }
    }
  }, [isOpen, isAuthenticated, user, fetchThreads]);

  const handleThreadClick = (threadId: string) => {
    router.push(`/chat/${threadId}`);
    onClose();
  };

  const handleSignOut = async () => {
    try {
      // Clear threads and cache on sign out
      setThreads([]);
      cachedThreadsRef.current = null;
      
      // Clear all thread cache for this user
      if (user) {
        localStorage.removeItem(`sidebar_threads_${user.id}`);
      }
      
      // Use Supabase signOut function
      await signOut();
      
      // Navigate to home
      router.push('/');
    } catch (error) {
      console.error("Error during sign out:", error);
      // If something goes wrong, still try to get to homepage with auth dialog
      window.location.href = `/?error=signout&t=${Date.now()}`;
    }
  };

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the thread click
    
    try {
      // Optimistically update the UI right away
      const updatedThreads = threads.filter(thread => thread.id !== threadId);
      setThreads(updatedThreads);
      
      // Update cache immediately for better UX
      updateThreadCache(updatedThreads);
      
      // Now actually delete on the server
      const response = await fetch(`/api/chat/threads/${threadId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        // If deletion fails, revert the optimistic update
        console.error('Failed to delete thread, reverting UI');
        fetchThreads(true);
      }
      
      // If we're on the deleted thread's page, go home
      if (pathname === `/chat/${threadId}`) {
        router.push('/');
      }
    } catch (error) {
      console.error('Error deleting thread:', error);
      // Revert on error
      fetchThreads(true);
    }
  };

  return (
    <>
      {/* Overlay - only visible when sidebar is open */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/40 z-40 transition-opacity",
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
                  className="px-4 py-2 text-sm font-medium bg-[var(--brand-default)] text-white rounded-md hover:bg-[var(--brand-darker)] shadow-sm transition-all hover:shadow"
                >
                  Sign In
                </button>
              </div>
            ) : isLoading && threads.length === 0 ? (
              <div className="flex justify-center items-center h-24">
                {/* Pulsing dots loading indicator */}
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-[var(--brand-darker)] animate-[bounce_1s_infinite]"></div>
                  <div className="w-2 h-2 bg-[var(--brand-darker)] animate-[bounce_1s_infinite_200ms]"></div>
                  <div className="w-2 h-2 bg-[var(--brand-darker)] animate-[bounce_1s_infinite_400ms]"></div>
                </div>
              </div>
            ) : fetchError ? (
              <div className="text-center py-4 px-3 bg-[var(--accent-red-faint)] border border-[var(--accent-red-muted)] rounded-md">
                <p className="text-[var(--accent-red)] text-sm">{fetchError}</p>
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-sm text-[var(--text-light-muted)] mb-2">No chat history yet</p>
                <Link 
                  href="/"
                  className="text-sm text-[var(--brand-default)] hover:text-[var(--brand-darker)] hover:underline"
                >
                  Start a new chat
                </Link>
              </div>
            ) : (
              // Thread list
              <div className="space-y-1.5">
                {threads.map((thread) => (
                  <div
                    key={thread.id}
                    onClick={() => handleThreadClick(thread.id)}
                    className={cn(
                      "group p-2 rounded-md flex items-center justify-between cursor-pointer transition-colors",
                      pathname === `/chat/${thread.id}` 
                        ? "bg-[var(--brand-faint)] text-[var(--brand-default)]" 
                        : "hover:bg-[var(--secondary-default)] text-[var(--text-light-default)]"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{thread.title || "Untitled chat"}</div>
                      {thread.updatedAt && (
                        <div className="text-xs text-[var(--text-light-muted)]">
                          {formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDeleteThread(thread.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--text-light-muted)] hover:text-[var(--accent-red)] rounded-full hover:bg-[var(--secondary-darker)] transition-colors"
                      aria-label="Delete thread"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer with Sign Out button */}
          {isAuthenticated && (
            <div className="p-4 border-t border-[var(--secondary-darkest)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-[var(--brand-default)] flex items-center justify-center text-white">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <div className="ml-2 overflow-hidden">
                    <div className="text-xs font-medium truncate text-[var(--text-light-default)]">
                      {user?.email ? user.email.split('@')[0] : 'User'}
                    </div>
                    {user?.email && (
                      <div className="text-[10px] text-[var(--text-light-muted)] truncate">
                        {user.email}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-1.5 text-[var(--text-light-muted)] hover:text-[var(--text-light-default)] rounded-full hover:bg-[var(--secondary-darker)] transition-colors"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 