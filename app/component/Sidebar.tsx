'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChatThread } from '@/lib/redis';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

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
  
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, signOut } = useAuth();
  
  // Improved function to fetch threads with better error handling
  const fetchThreads = useCallback(async (force = false) => {
    // Skip if there's already a fetch in progress
    if (isFetchingRef.current) return;
    
    // Skip if sidebar is closed (will fetch when opened)
    if (!isOpen) return;
    
    // Debounce fetches within 5 seconds unless forced
    const now = Date.now();
    if (!force && now - lastFetchTime < 5000) return;
    
    // Don't fetch if not authenticated
    if (!isAuthenticated || !user) {
      setThreads([]);
      setFetchError(null);
      setIsLoading(false);
      return;
    }
    
    isFetchingRef.current = true;
    setLastFetchTime(now);
    
    try {
      setIsLoading(true);
      setFetchError(null);
      
      const response = await fetch('/api/chat/threads', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Auth error - redirect to auth page
          setFetchError('Please sign in to view your chat history');
          setThreads([]);
          return;
        } else {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      if (data.success) {
        // Sort threads by updatedAt date, newest first
        const sortedThreads = [...data.threads].sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setThreads(sortedThreads);
      } else {
        setFetchError(data.error || 'Failed to load chat history');
        setThreads([]);
      }
    } catch (error) {
      console.error('Error fetching threads:', error);
      setFetchError('Failed to load chat history');
      setThreads([]);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [user, isOpen, isAuthenticated, lastFetchTime]);

  // Fetch when refreshTrigger changes
  useEffect(() => {
    if (isAuthenticated && user && isOpen) {
      if (lastRefreshTrigger !== refreshTrigger) {
        setLastRefreshTrigger(refreshTrigger);
        fetchThreads(true); // Force fetch when refresh trigger changes
      }
    }
  }, [refreshTrigger, isAuthenticated, user, isOpen, lastRefreshTrigger, fetchThreads]);

  // Also fetch when sidebar opens
  useEffect(() => {
    if (isOpen && isAuthenticated && user) {
      fetchThreads();
    }
  }, [isOpen, isAuthenticated, user, fetchThreads]);

  // Fetch when authentication state changes
  useEffect(() => {
    if (isOpen && isAuthenticated && user) {
      fetchThreads(true);
    }
  }, [isAuthenticated, user, isOpen, fetchThreads]);

  const handleThreadClick = (threadId: string) => {
    router.push(`/chat/${threadId}`);
    onClose();
  };

  const handleSignOut = async () => {
    try {
      // Clear threads for immediate UI feedback
      setThreads([]);
      
      console.log("Redirecting to force-logout endpoint");
      // No need for complex client-side logout logic - just redirect to our force-logout endpoint
      window.location.href = `/api/auth/force-logout?t=${Date.now()}&r=${Math.random().toString(36).substring(7)}`;
    } catch (error) {
      console.error("Error during sign out:", error);
      // If something goes wrong, still try to get to homepage with auth dialog
      window.location.href = `/?error=signout&t=${Date.now()}`;
    }
  };

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the thread click
    
    try {
      const response = await fetch(`/api/chat/threads/${threadId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        // Update local state instead of refetching
        setThreads(prev => prev.filter(thread => thread.id !== threadId));
        
        // If we're on the deleted thread's page, go home
        if (pathname === `/chat/${threadId}`) {
          router.push('/');
        }
      } else {
        console.error('Failed to delete thread');
      }
    } catch (error) {
      console.error('Error deleting thread:', error);
    }
  };

  return (
    <>
      {/* Overlay - only visible when sidebar is open */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 right-0 z-50 w-64 bg-[#fffdf5] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 sidebar-open' : 'translate-x-full'
        } border-l-2 border-black`}
      >
        {/* Sidebar content */}
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b-2 border-black">
            <h2 className="text-lg font-bold">Chat History</h2>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-[#f5f3e4] border border-black"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {!isAuthenticated ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <p className="text-sm text-center text-gray-700">Sign in to view your chat history</p>
                <button
                  onClick={onSignInClick}
                  className="px-4 py-2 text-sm font-medium text-white bg-black rounded-none border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  Sign In
                </button>
              </div>
            ) : isLoading ? (
              <div className="flex justify-center items-center h-24">
                {/* Pulsing dots loading indicator */}
                <div className="flex space-x-2">
                  <div className="w-2.5 h-2.5 bg-black  animate-pulse"></div>
                  <div className="w-2.5 h-2.5 bg-black  animate-pulse delay-150"></div>
                  <div className="w-2.5 h-2.5 bg-black  animate-pulse delay-300"></div>
                </div>
              </div>
            ) : fetchError ? (
              <div className="text-center py-3">
                <p className="text-red-500">{fetchError}</p>
                <button
                  onClick={() => fetchThreads(true)}
                  className="mt-2 px-3 py-1 bg-[#f5f3e4] rounded-md hover:bg-[#e9e7d8] text-sm border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  Try Again
                </button>
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-3">
                <p className="text-gray-700">No chat history yet</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {threads.map((thread) => (
                  <li key={thread.id} className="border-2 border-black rounded-md overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <button
                      onClick={() => handleThreadClick(thread.id)}
                      className={`w-full text-left p-2 ${pathname === `/chat/${thread.id}` ? 'bg-[#f5f3e4]' : 'hover:bg-[#f5f3e4]'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-medium truncate pr-2 text-sm">{thread.title}</div>
                        <button
                          onClick={(e) => handleDeleteThread(thread.id, e)}
                          className="p-0.5 text-gray-600 hover:text-gray-900 hover:bg-[#e9e7d8] rounded-md border border-gray-400"
                          title="Delete thread"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {new Date(thread.updatedAt).toLocaleString()}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {/* Footer with user info and sign out */}
          {isAuthenticated && user && (
            <div className="p-3 border-t-2 border-black">
              <div className="flex justify-between items-center">
                <div className="text-sm truncate">
                  <span className="font-medium">{user.name || user.email}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-2 py-1 bg-[#f5f3e4] text-sm rounded-md hover:bg-[#e9e7d8] border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 