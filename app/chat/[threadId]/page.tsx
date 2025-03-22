'use client';

import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Message, Model, ModelType } from '../../types';
import Header from '../../component/Header';
import ChatMessages from '../../component/ChatMessages';
import ChatInput from '../../component/ChatInput';
import Sidebar from '../../component/Sidebar';
import { fetchResponse } from '../../api/apiService';
import modelsData from '../../../models.json';
import { AuthDialog } from '@/components/AuthDialog';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ChatThread } from '@/lib/redis';
import { toast } from 'sonner';
import { usePathname } from 'next/navigation';

export default function ChatThreadPage({ params }: { params: { threadId: string } }) {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [isThreadLoading, setIsThreadLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<ModelType>('exa');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [refreshSidebar, setRefreshSidebar] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, isLoading: authLoading, openAuthDialog, refreshSession } = useAuth();
  const router = useRouter();
  const { threadId } = params;
  
  // Auth state
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const isAuthenticated = !!user;
  
  // Thread saving state
  const threadSaveQueue = useRef<Array<{messages: Message[], timestamp: number}>>([]);
  const isSavingThread = useRef(false);
  const threadSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [models, setModels] = useState<Model[]>([
    {
      id: 'exa',
      name: 'Exa Search',
      provider: 'Exa',
      providerId: 'exa',
      enabled: true,
      toolCallType: 'native',
      searchMode: true
    }
  ]);

  useEffect(() => {
    // Add models from different providers
    const groqModels = modelsData.models.filter(model => model.providerId === 'groq');
    const googleModels = modelsData.models.filter(model => model.providerId === 'google');
    const openRouterModels = modelsData.models.filter(model => model.providerId === 'openrouter');
    
    // Replace the model list instead of appending
    setModels([
      {
        id: 'exa',
        name: 'Exa Search',
        provider: 'Exa',
        providerId: 'exa',
        enabled: true,
        toolCallType: 'native',
        searchMode: true
      },
      ...googleModels,
      ...openRouterModels,
      ...groqModels
    ]);
  }, []);

  useEffect(() => {
    const fetchThread = async () => {
      if (!threadId) return;

      try {
        setIsThreadLoading(true);
        // Add a timestamp to prevent caching
        const timestamp = Date.now();
        const response = await fetch(`/api/chat/threads/${threadId}?t=${timestamp}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 404) {
            // Thread not found, but don't redirect - just mark as loaded
            setIsThreadLoading(false);
            return;
          } else if (response.status === 401) {
            // Try to refresh the session
            toast.info('Attempting to fix session...');
            
            // Call the fix-session endpoint
            const fixResponse = await fetch('/api/fix-session', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
              }
            });
            
            if (fixResponse.ok) {
              // Try fetching the thread again after fixing the session
              const retryResponse = await fetch(`/api/chat/threads/${threadId}?t=${Date.now()}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Content-Type': 'application/json'
                }
              });
              
              if (retryResponse.ok) {
                // Success! Process the data
                const data = await retryResponse.json();
                if (data.success && data.thread) {
                  setThread(data.thread);
                  setMessages(data.thread.messages || []);
                  // If it has an associated model, set it
                  if (data.thread.model) {
                    setSelectedModel(data.thread.model as ModelType);
                  }
                  setIsThreadLoading(false);
                  return;
                }
              }
            }
            
            // If we got here, fixing the session didn't work
            setShowAuthDialog(true);
            setIsThreadLoading(false);
            return;
          }
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success && data.thread) {
          setThread(data.thread);
          setMessages(data.thread.messages || []);
          // If it has an associated model, set it
          if (data.thread.model) {
            setSelectedModel(data.thread.model as ModelType);
          }
        } else {
          // Thread data issue, but don't redirect
          console.error('Failed to load thread:', data.error);
        }
      } catch (error) {
        console.error('Error loading thread:', error);
        // Don't redirect on error, just log it
      } finally {
        setIsThreadLoading(false);
      }
    };

    if (threadId) {
      fetchThread();
    }
  }, [threadId, isAuthenticated, user, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId as ModelType);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Update thread in database - now optimized for efficient storage
  const updateThread = async (updatedMessages: Message[]) => {
    if (!isAuthenticated || !user || !threadId) {
      // Don't show auth dialog here - this is a background operation now
      console.log('Cannot save thread - not authenticated or no thread ID');
      return false;
    }
    
    try {
      // Add timestamp to prevent caching
      const timestamp = Date.now();
      console.time('threadSave'); // Start timing
      
      const response = await fetch(`/api/chat/threads/${threadId}?t=${timestamp}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        credentials: 'include',
        body: JSON.stringify({
          messages: updatedMessages,
          model: selectedModel
        })
      });
      
      console.timeEnd('threadSave'); // Log how long it took
      
      if (!response.ok) {
        if (response.status === 401) {
          // Auth error - but don't show dialog for background operations
          console.log('Authentication error saving thread - ignoring');
          return false;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        // Update sidebar to reflect changes
        setRefreshSidebar(prev => prev + 1);
        
        // Update the local cache with the current thread to ensure sidebar shows latest
        if (user && thread) {
          try {
            // Try to get the current cache
            const cachedData = localStorage.getItem(`sidebar_threads_${user.id}`);
            if (cachedData) {
              const cacheObj = JSON.parse(cachedData);
              if (cacheObj && Array.isArray(cacheObj.threads)) {
                // Update the thread in the cache or add it if not found
                const updatedThread = {
                  ...thread,
                  messages: updatedMessages,
                  model: selectedModel,
                  updatedAt: new Date().toISOString()
                };
                
                let found = false;
                const updatedThreads = cacheObj.threads.map((t: any) => {
                  if (t.id === threadId) {
                    found = true;
                    // Only update minimal thread data in the cached list
                    return {
                      ...t,
                      title: updatedThread.title,
                      updatedAt: updatedThread.updatedAt
                    };
                  }
                  return t;
                });
                
                // If thread wasn't in cache, add it
                if (!found) {
                  updatedThreads.unshift({
                    id: threadId,
                    title: updatedThread.title,
                    updatedAt: updatedThread.updatedAt
                  });
                }
                
                // Update the cache with new thread list and timestamp
                const updatedCache = {
                  ...cacheObj,
                  timestamp: Date.now(),
                  threads: updatedThreads
                };
                
                localStorage.setItem(`sidebar_threads_${user.id}`, JSON.stringify(updatedCache));
              }
            }
          } catch (cacheError) {
            console.error('Error updating thread cache:', cacheError);
            // Non-critical error, we can continue
          }
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating thread:', error);
      // Don't show auth dialog for background thread saves
      return false;
    }
  };

  // Process the thread save queue efficiently
  const processSaveQueue = useCallback(async () => {
    if (isSavingThread.current || threadSaveQueue.current.length === 0) return;
    
    isSavingThread.current = true;
    
    try {
      // Check authentication status first
      if (!isAuthenticated || !user) {
        // Don't show auth dialog here, just clear the queue and skip saving
        threadSaveQueue.current = [];
        console.log('Skipping thread save - user not authenticated');
        return;
      }
      
      // Try to refresh the session silently first
      try {
        // Call refreshSession but don't wait for it (fire and forget)
        refreshSession().catch((e: Error) => console.log('Session refresh background error:', e));
      } catch (e) {
        // Ignore refresh errors - we'll still try to save
      }
      
      // Get latest save request
      const latestSave = threadSaveQueue.current[threadSaveQueue.current.length - 1];
      threadSaveQueue.current = []; // Clear the queue
      
      // Call the actual thread update
      await updateThread(latestSave.messages);
    } catch (error) {
      console.error('Background thread save error:', error);
      // Don't show auth dialog for background saves - just log the error
    } finally {
      isSavingThread.current = false;
      
      // Process any new requests that came in while saving
      if (threadSaveQueue.current.length > 0) {
        processSaveQueue();
      }
    }
  }, [isAuthenticated, user, updateThread, refreshSession]);

  // Queue thread save with debouncing
  const queueThreadSave = useCallback((messages: Message[]) => {
    // Add to queue
    threadSaveQueue.current.push({
      messages,
      timestamp: Date.now()
    });
    
    // Clear any existing timeout
    if (threadSaveTimeoutRef.current) {
      clearTimeout(threadSaveTimeoutRef.current);
    }
    
    // Set a new timeout to process queue after short delay (debouncing)
    threadSaveTimeoutRef.current = setTimeout(() => {
      if (!isSavingThread.current) {
        processSaveQueue();
      }
    }, 1000); // 1 second debounce
  }, [processSaveQueue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Don't submit if auth dialog is open
    if (showAuthDialog) {
      return;
    }

    // Create new user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim()
    };

    // Create placeholder for assistant response
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: ''
    };

    // Update UI right away
    setInput('');
    setIsLoading(true);
    const updatedMessages = [...messages, userMessage, assistantMessage];
    setMessages(updatedMessages);

    // Cancel any previous requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    let content = "";
    let citations: any[] = [];
    let contentReceived = false;

    try {
      // Check if it's a new thread or existing thread
      const isNewThread = !threadId || threadId === 'new';
      
      // Queue thread save instead of awaiting it
      if (user && isAuthenticated) {
        queueThreadSave(updatedMessages);
      }

      // Then, fetch the model response
      const response = await fetchResponse(
        userMessage.content,
        updatedMessages.slice(0, -1), // Exclude the empty assistant message
        selectedModel,
        abortControllerRef.current,
        setMessages,
        assistantMessage
      );
      
      content = response.content;
      citations = response.citations || [];
      contentReceived = true;

      // Update the thread again with the completed response, but don't await
      if (user && isAuthenticated) {
        const finalMessages = [...messages, userMessage, {
          ...assistantMessage,
          content,
          citations,
          completed: true
        }];
        
        queueThreadSave(finalMessages);
      }
      
    } catch (error: any) {
      console.error("Error in submission:", error);
      
      // Handle authentication errors
      if (error.message && (
          error.message.includes('authentication') || 
          error.message.includes('Authentication') || 
          error.message.includes('Unauthorized') || 
          error.message.includes('401') ||
          error.message.includes('session')
        )) {
        // Show the auth dialog first to let the user sign in
        setShowAuthDialog(true);
        
        // Set the error message in the assistant message
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, content: "I couldn't complete your request because your session expired. Please sign in again.", completed: true } 
              : msg
          )
        );
      } else {
        // Handle other errors
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, content: "I'm sorry, there was an error processing your request. Please try again.", completed: true } 
              : msg
          )
        );
        
        // Show error toast
        toast.error(error.message || 'Error processing request');
      }
    } finally {
      // Clear the abort controller reference
      abortControllerRef.current = null;

      // Always ensure loading is stopped, regardless of outcome
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    router.push('/');
  };

  // Determine if the selected model is Exa
  const isExa = selectedModel === 'exa';

  // Get the provider name for the selected model
  const selectedModelObj = models.find(model => model.id === selectedModel);

  if (isThreadLoading) {
    return (
      <main className="flex min-h-screen flex-col">
        <Header toggleSidebar={toggleSidebar} />
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
          onSignInClick={() => setShowAuthDialog(true)}
        />
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center space-y-4">
            <div className="flex space-x-2 mt-2">
              <div className="w-3 h-3 bg-[var(--brand-darker)] animate-[bounce_0.6s_infinite_0.1s]"></div>
              <div className="w-3 h-3 bg-[var(--brand-darker)] animate-[bounce_0.6s_infinite_0.2s]"></div>
              <div className="w-3 h-3 bg-[var(--brand-darker)] animate-[bounce_0.6s_infinite_0.3s]"></div>
            </div>
            <div className="text-gray-600 font-medium">Loading conversation...</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      <Header toggleSidebar={toggleSidebar} />
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onSignInClick={() => setShowAuthDialog(true)}
        refreshTrigger={refreshSidebar}
      />
      
      <ChatMessages 
        messages={messages} 
        isLoading={isLoading} 
        selectedModel={selectedModel}
        selectedModelObj={selectedModelObj}
        isExa={isExa}
      />

      <ChatInput 
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        selectedModel={selectedModel}
        handleModelChange={handleModelChange}
        models={models}
        isExa={isExa}
        onNewChat={handleNewChat}
      />

      {/* Auth Dialog */}
      <AuthDialog 
        isOpen={showAuthDialog} 
        onClose={() => setShowAuthDialog(false)}
        onSuccess={() => {
          setRefreshSidebar(prev => prev + 1);
          // Reload the thread data
          if (threadId) {
            setIsThreadLoading(true);
            const fetchData = async () => {
              try {
                // Add a timestamp to ensure we don't get a cached response
                const timestamp = Date.now();
                const response = await fetch(`/api/chat/threads/${threadId}?t=${timestamp}`, {
                  cache: 'no-store',
                  credentials: 'include'
                });
                
                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                if (data.thread) {
                  setThread(data.thread);
                  setMessages(data.thread.messages || []);
                  setSelectedModel(data.thread.model || 'exa');
                }
              } catch (error) {
                console.error('Error fetching thread:', error);
                toast.error('Failed to load chat. Please try again.');
              } finally {
                setIsThreadLoading(false);
              }
            };
            
            fetchData();
          }
        }}
      />
    </main>
  );
} 