'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { ChatThread } from '@/lib/redis';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { getAssetPath } from '@/app/utils';

// Constants for caching
const CACHE_KEY = 'exachat_thread_cache';
const CACHE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface ThreadCache {
  threads: ChatThread[];
  timestamp: number;
  userId: string;
}

interface ThreadCacheContextType {
  threads: ChatThread[];
  isLoading: boolean;
  fetchThreads: (forceRefresh?: boolean) => Promise<void>;
  addThread: (thread: ChatThread) => void;
  updateThread: (threadId: string, updates: Partial<ChatThread>) => void;
  removeThread: (threadId: string) => void;
  clearThreads: () => void;
  lastUpdated: number;
}

export const ThreadCacheContext = createContext<ThreadCacheContextType>({
  threads: [],
  isLoading: false,
  fetchThreads: async () => {},
  addThread: () => {},
  updateThread: () => {},
  removeThread: () => {},
  clearThreads: () => {},
  lastUpdated: 0
});

export const useThreadCache = () => useContext(ThreadCacheContext);

interface ThreadCacheProviderProps {
  children: ReactNode;
}

export const ThreadCacheProvider: React.FC<ThreadCacheProviderProps> = ({ children }) => {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);
  const { user, refreshSession } = useAuth();
  
  const isAuthenticated = !!user;
  const userId = user?.id || '';
  const isFetchingRef = useRef(false);

  // Load threads from cache
  const loadFromCache = useCallback(() => {
    if (!isAuthenticated || !userId) return null;
    
    try {
      const cacheData = localStorage.getItem(CACHE_KEY);
      if (!cacheData) return null;
      
      const cache: ThreadCache = JSON.parse(cacheData);
      
      // Check if cache is for the current user
      if (cache.userId !== userId) return null;
      
      // Check if cache has expired
      const now = Date.now();
      if (now - cache.timestamp > CACHE_TIMEOUT_MS) return null;
      
      return cache.threads;
    } catch (e) {
      console.error('Error loading thread cache:', e);
      return null;
    }
  }, [isAuthenticated, userId]);

  // Save threads to cache
  const saveToCache = useCallback((threadData: ChatThread[]) => {
    if (!isAuthenticated || !userId) return;
    
    try {
      const cacheData: ThreadCache = {
        threads: threadData,
        timestamp: Date.now(),
        userId
      };
      
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      setLastUpdated(Date.now());
    } catch (e) {
      console.error('Error saving thread cache:', e);
    }
  }, [isAuthenticated, userId]);

  // Function to fetch threads from the API
  const fetchThreads = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated) {
      setThreads([]);
      setIsLoading(false);
      return;
    }
    if (isFetchingRef.current) {
      // Already fetching, skip
      return;
    }
    isFetchingRef.current = true;
    // If not forcing refresh, try to use cache
    if (!forceRefresh) {
      const cachedThreads = loadFromCache();
      if (cachedThreads) {
        setThreads(cachedThreads);
        isFetchingRef.current = false;
        return;
      }
    }
    setIsLoading(true);
    try {
      const response = await fetch(getAssetPath('/api/chat/threads?limit=10&withMessages=true'), {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.threads)) {
          setThreads(data.threads);
          saveToCache(data.threads);
        } else {
          setThreads([]);
        }
      } else if (response.status === 401) {
        try {
          await refreshSession();
          const retryResponse = await fetch(getAssetPath('/api/chat/threads?limit=10&withMessages=true'), {
            credentials: 'include',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            }
          });
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            if (retryData.success && Array.isArray(retryData.threads)) {
              setThreads(retryData.threads);
              saveToCache(retryData.threads);
            } else {
              setThreads([]);
            }
          } else {
            setThreads([]);
          }
        } catch (refreshError) {
          setThreads([]);
        }
      } else {
        setThreads([]);
      }
    } catch (error) {
      setThreads([]);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [isAuthenticated, refreshSession, loadFromCache, saveToCache]);

  // Function to add a thread to the cache
  const addThread = useCallback((thread: ChatThread) => {
    setThreads(currentThreads => {
      // Check if thread already exists
      const exists = currentThreads.some(t => t.id === thread.id);
      if (exists) return currentThreads;
      
      // Add new thread to the beginning of the array
      const newThreads = [thread, ...currentThreads];
      saveToCache(newThreads);
      return newThreads;
    });
  }, [saveToCache]);

  // Function to update a thread in the cache
  const updateThread = useCallback((threadId: string, updates: Partial<ChatThread>) => {
    setThreads(currentThreads => {
      const threadIndex = currentThreads.findIndex(t => t.id === threadId);
      if (threadIndex === -1) return currentThreads;
      
      const updatedThreads = [...currentThreads];
      updatedThreads[threadIndex] = {
        ...updatedThreads[threadIndex],
        ...updates,
        updatedAt: new Date().toISOString() // Update the timestamp
      };
      
      saveToCache(updatedThreads);
      return updatedThreads;
    });
  }, [saveToCache]);

  // Function to remove a thread from the cache
  const removeThread = useCallback((threadId: string) => {
    setThreads(currentThreads => {
      const updatedThreads = currentThreads.filter(t => t.id !== threadId);
      saveToCache(updatedThreads);
      return updatedThreads;
    });
  }, [saveToCache]);

  // Function to clear all threads from the local state and cache
  const clearThreads = useCallback(() => {
    setThreads([]);
    // Also remove from localStorage cache
    try {
      localStorage.removeItem(CACHE_KEY);
      setLastUpdated(Date.now()); // Update timestamp after clearing
      console.log('Cleared thread cache and local state.');
    } catch (e) {
      console.error('Error removing thread cache from localStorage:', e);
    }
  }, []); // No dependencies needed as it just resets state/clears cache

  // Initial load from cache
  useEffect(() => {
    if (isAuthenticated) {
      const cachedThreads = loadFromCache();
      if (cachedThreads) {
        setThreads(cachedThreads);
      } else {
        fetchThreads(false);
      }
    } else {
      setThreads([]);
      // Clean up cache when not authenticated
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch (e) {
        console.error('Error clearing thread cache:', e);
      }
    }
  }, [isAuthenticated, loadFromCache, fetchThreads]);

  return (
    <ThreadCacheContext.Provider
      value={{
        threads,
        isLoading,
        fetchThreads,
        addThread,
        updateThread,
        removeThread,
        clearThreads,
        lastUpdated
      }}
    >
      {children}
    </ThreadCacheContext.Provider>
  );
}; 