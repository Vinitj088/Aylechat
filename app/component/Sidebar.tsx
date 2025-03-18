'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChatThread } from '@/lib/redis';
import { useAuth } from '@/context/AuthContext';

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
  const { user, isAuthenticated, logout } = useAuth();

  // Optimized function to fetch threads
  const fetchThreads = useCallback(async (force = false) => {
    // Don't fetch if not authenticated, sidebar is closed, already fetching, or no user
    if (!isAuthenticated || !user || !isOpen || isFetchingRef.current) return;
    
    // Debounce fetches within 5 seconds unless forced
    const now = Date.now();
    if (!force && now - lastFetchTime < 5000) return;
    
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
          setFetchError('Please sign in to view your chat history');
          setThreads([]);
        } else {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        return;
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

  // Only fetch when necessary: on initial open or refresh trigger change
  useEffect(() => {
    if (isAuthenticated && user && isOpen) {
      // Only fetch on initial login or when refreshTrigger changes
      if (lastRefreshTrigger !== refreshTrigger) {
        setLastRefreshTrigger(refreshTrigger);
        fetchThreads(true); // Force fetch when refresh trigger changes
      }
    }
  }, [refreshTrigger, isAuthenticated, user, isOpen, lastRefreshTrigger, fetchThreads]);

  // Also fetch when sidebar opens if user is authenticated
  useEffect(() => {
    if (isOpen && isAuthenticated && user) {
      fetchThreads();
    }
  }, [isOpen, isAuthenticated, user, fetchThreads]);

  const handleThreadClick = (threadId: string) => {
    router.push(`/chat/${threadId}`);
    onClose();
  };

  const handleSignOut = async () => {
    try {
      await logout();
      setThreads([]);
      router.push('/');
      onClose();
    } catch (error) {
      console.error('Error signing out:', error);
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
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-gray-700 mb-3 text-center">Sign in to view your chat history</p>
                <button
                  onClick={onSignInClick}
                  className="px-3 py-1.5 bg-black text-white rounded-md hover:bg-gray-800 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
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
          
          {/* User profile */}
          {isAuthenticated && user && (
            <div className="p-3 border-t-2 border-black">
              <div className="flex items-center">
                <div className="w-7 h-7 bg-black text-white rounded-md flex items-center justify-center border border-black">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="ml-2 flex-1 overflow-hidden">
                  <div className="font-medium truncate text-sm">{user.name || 'User'}</div>
                  <div className="text-xs text-gray-600 truncate">{user.email}</div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-[#f5f3e4] rounded-md border border-gray-400"
                  title="Sign out"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 