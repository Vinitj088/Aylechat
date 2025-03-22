'use client';

import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Message, Model, ModelType } from './types';
import Header from './component/Header';
import ChatMessages from './component/ChatMessages';
import ChatInput from './component/ChatInput';
import MobileSearchUI from './component/MobileSearchUI';
import DesktopSearchUI from './component/DesktopSearchUI';
import Sidebar from './component/Sidebar';
import { fetchResponse } from './api/apiService';
import modelsData from '../models.json';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AuthDialog } from '@/components/AuthDialog';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { prefetchAll } from './api/prefetch';

// Create a new component that uses useSearchParams
function PageContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('mistralai/mistral-small-3.1-24b-instruct:free');
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
  const [autoprompt, setAutoprompt] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [refreshSidebar, setRefreshSidebar] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, session, isLoading: authLoading, openAuthDialog, refreshSession } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isAuthenticated = !!user;

  // Prefetch API modules and data when the app loads
  useEffect(() => {
    // Prefetch all API modules and data for faster initial response times
    prefetchAll().catch(() => {
      // Silently ignore prefetch errors as this is just an optimization
    });
  }, []);

  // Check URL parameters for auth dialog control
  useEffect(() => {
    const authRequired = searchParams.get('authRequired');
    const expired = searchParams.get('expired');
    const error = searchParams.get('error');
    const sessionError = searchParams.get('session_error');
    const cookieError = searchParams.get('cookie_error');
    
    // Show auth dialog if any of these params are present
    if (authRequired === 'true' || expired === 'true' || error) {
      openAuthDialog();
      
      // Show toast message if session expired
      if (expired === 'true') {
        toast.error('Your session has expired. Please sign in again.');
      }
      
      // Show toast message if there was an error
      if (error) {
        toast.error('Authentication error. Please sign in again.');
      }
      
      // Clean URL by removing query parameters without reloading the page
      const url = new URL(window.location.href);
      url.searchParams.delete('authRequired');
      url.searchParams.delete('expired');
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url);
    }

    // Handle session format errors
    if (sessionError === 'true' || cookieError === 'true') {
      toast.error('Session format issue detected', {
        description: 'Please click the "Auth Debug" button and use "Fix Session Issues"',
        duration: 10000,
        action: {
          label: 'Fix Now',
          onClick: async () => {
            try {
              // Call the fix-session API
              const response = await fetch('/api/fix-session', {
                method: 'POST',
                credentials: 'include',
              });
              
              if (response.ok) {
                toast.success('Session cookies cleared', {
                  description: 'Please sign in again to get a fresh session'
                });
                
                // Force sign in dialog
                openAuthDialog();
              } else {
                toast.error('Could not fix session cookies');
              }
            } catch (e) {
              console.error('Error fixing session:', e);
              toast.error('Error fixing session');
            }
          }
        }
      });
      
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('session_error');
      url.searchParams.delete('cookie_error');
      window.history.replaceState({}, '', url);
    }
  }, [searchParams, openAuthDialog]);

  // Check for authRequired query param
  useEffect(() => {
    if (searchParams.get('authRequired') === 'true') {
      openAuthDialog();
    }
  }, [searchParams, openAuthDialog]);

  // Load models and set initially selected model
  useEffect(() => {
    // Load models from models.json and set initial model
    const groqModels = modelsData.models.filter(model => model.providerId === 'groq');
    const googleModels = modelsData.models.filter(model => model.providerId === 'google');
    const openRouterModels = modelsData.models.filter(model => model.providerId === 'openrouter');
    
    // Start with just the Exa model and then add the others
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
    
    // Get search params
    const searchParams = new URLSearchParams(window.location.search);
    const modelParam = searchParams.get('model');
    
    if (modelParam) {
      setSelectedModel(modelParam);
    }
  }, []);

  // Handle showing the auth dialog if opened via URL param
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('signIn') === 'true' || urlParams.get('auth') === 'true') {
      openAuthDialog();
    }
  }, [openAuthDialog]);

  // Function to handle login button click
  const handleLoginClick = useCallback(() => {
    openAuthDialog();
  }, [openAuthDialog]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId as ModelType);
  };

  const toggleAutoprompt = () => {
    setAutoprompt(!autoprompt);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Handle successful auth
  const handleAuthSuccess = async () => {
    // Refresh sidebar to show latest threads
    setRefreshSidebar(prev => prev + 1);
    
    // Process pending input if any
    if (input.trim()) {
      setTimeout(() => {
        handleSubmit({ preventDefault: () => {} } as React.FormEvent);
      }, 300);
    }
  };

  // Triggered when authentication state changes - load threads
  useEffect(() => {
    if (isAuthenticated) {
      // Only trigger sidebar refresh on auth state change
      setRefreshSidebar(prev => prev + 1);
    }
  }, [isAuthenticated]);

  // Add a check for session validity on initial load and tab visibility changes
  useEffect(() => {
    // Validate session on initial page load
    if (user) {
      console.log('Validating session on initial load');
      refreshSession().catch(e => {
        console.error('Session refresh on load failed:', e);
      });
    }
    
    // Also revalidate on visibility change (tab focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        console.log('Tab became visible, validating session');
        refreshSession().catch(e => {
          console.error('Session refresh on visibility change failed:', e);
        });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, refreshSession]);

  // Error handler callback function
  const handleRequestError = async (error: Error) => {
    // Check if the error is an authentication error
    if (
      error.message.includes('authentication') || 
      error.message.includes('Authentication') || 
      error.message.includes('auth') || 
      error.message.includes('Auth') ||
      error.message.includes('401') ||
      error.message.includes('Unauthorized')
    ) {
      // Handle authentication errors by showing the auth dialog
      openAuthDialog();
    } else if (error.message.includes('Rate limit')) {
      // Handle rate limit errors
      // This is a custom error with timeout info from the API service
      // @ts-ignore - We're adding custom props to the error
      const waitTime = error.waitTime || 30;
      
      toast.error('RATE LIMIT', {
        description: `Please wait ${waitTime} seconds before trying again`,
        duration: 5000,
      });
    } else {
      // Handle other errors - show a toast
      toast.error('Error Processing Request', {
        description: error.message || 'Please try again later',
        duration: 5000,
      });
    }
  };

  // Thread saving state management
  const threadSaveQueue = useRef<Array<{messages: Message[], title?: string, timestamp: number}>>([]);
  const isSavingThread = useRef(false);
  const threadSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Process the thread save queue efficiently
  const processSaveQueue = useCallback(async () => {
    if (isSavingThread.current || threadSaveQueue.current.length === 0) return;
    
    isSavingThread.current = true;
    
    try {
      // Get latest save request
      const latestSave = threadSaveQueue.current[threadSaveQueue.current.length - 1];
      threadSaveQueue.current = []; // Clear the queue
      
      // Call the actual thread update
      await createOrUpdateThread({
        messages: latestSave.messages,
        title: latestSave.title
      });
      
    } catch (error) {
      console.error('Background thread save error:', error);
    } finally {
      isSavingThread.current = false;
      
      // Process any new requests that came in while saving
      if (threadSaveQueue.current.length > 0) {
        processSaveQueue();
      }
    }
  }, []);

  // Queue thread save with debouncing
  const queueThreadSave = useCallback((threadContent: { messages: Message[], title?: string }) => {
    // Add to queue
    threadSaveQueue.current.push({
      ...threadContent,
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

  // Thread creation/update function
  const createOrUpdateThread = async (threadContent: { messages: Message[], title?: string }) => {
    console.time('threadSave'); // Start timing
    
    if (!isAuthenticated || !user) {
      // Show auth dialog instead of redirecting
      openAuthDialog();
      return null;
    }

    try {
      // Try to refresh the session before saving
      await refreshSession().catch(e => {
        console.log('Session refresh failed:', e);
        // Continue anyway, as the current session might still be valid
      });
      
      const method = currentThreadId ? 'PUT' : 'POST';
      const endpoint = currentThreadId 
        ? `/api/chat/threads/${currentThreadId}` 
        : '/api/chat/threads';
      
      // Add a timestamp to ensure we don't get a cached response
      const timestamp = Date.now();
      
      const response = await fetch(`${endpoint}?t=${timestamp}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        credentials: 'include',
        body: JSON.stringify({
          ...threadContent,
          model: selectedModel
        })
      });
      
      console.timeEnd('threadSave'); // End timing

      if (!response.ok) {
        if (response.status === 401) {
          // Auth error - show auth dialog
          openAuthDialog();
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.thread) {
        // Update thread ID if it's a new thread
        if (!currentThreadId) {
          setCurrentThreadId(result.thread.id);
          
          // Update the URL to the new thread without forcing a reload
          window.history.pushState({}, '', `/chat/${result.thread.id}`);
        }
        
        // Update the local cache with the current thread to ensure sidebar shows latest
        if (user) {
          try {
            // Get thread info to update in cache
            const threadId = result.thread.id;
            const threadTitle = threadContent.title || result.thread.title || "Untitled chat";
            const now = new Date().toISOString();
            
            // Try to get the current cache
            const cachedData = localStorage.getItem(`sidebar_threads_${user.id}`);
            
            if (cachedData) {
              // Update existing cache
              const cacheObj = JSON.parse(cachedData);
              if (cacheObj && Array.isArray(cacheObj.threads)) {
                // Check if thread exists in cache
                let found = false;
                const updatedThreads = cacheObj.threads.map((t: any) => {
                  if (t.id === threadId) {
                    found = true;
                    // Only update minimal thread data in the cached list
                    return {
                      ...t,
                      title: threadTitle,
                      updatedAt: now
                    };
                  }
                  return t;
                });
                
                // If thread wasn't in cache, add it to the beginning
                if (!found) {
                  updatedThreads.unshift({
                    id: threadId,
                    title: threadTitle,
                    updatedAt: now
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
            } else {
              // Create new cache with just this thread
              const newCache = {
                timestamp: Date.now(),
                threadHash: btoa(threadId),
                threads: [{
                  id: threadId,
                  title: threadTitle,
                  updatedAt: now
                }]
              };
              
              localStorage.setItem(`sidebar_threads_${user.id}`, JSON.stringify(newCache));
            }
          } catch (cacheError) {
            console.error('Error updating thread cache:', cacheError);
            // Non-critical error, we can continue
          }
        }
        
        // Refresh the sidebar to show the new/updated thread
        setRefreshSidebar(prev => prev + 1);
        
        return result.thread.id;
      }
      
      return null;
    } catch (error: any) {
      console.error('Error saving thread:', error);
      
      // Check if it's an auth error
      if (
        (error.message && error.message.toLowerCase().includes('unauthorized')) ||
        (error.message && (error.message.includes('parse') || error.message.includes('JSON')))
      ) {
        await handleRequestError(error);
      } else {
        toast.error('Error saving conversation');
      }
      
      return null;
    }
  };

  // Modify handleSubmit to use the queue
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Debug log for authentication state
    console.log('Auth state before submit:', { 
      isAuthenticated, 
      hasUser: !!user, 
      hasSession: !!session,
      userEmail: user?.email
    });

    // If not authenticated, show auth dialog and keep the message in the input
    if (!isAuthenticated || !user) {
      console.log('Not authenticated, showing auth dialog');
      openAuthDialog();
      return;
    }

    // Force session refresh before submitting to ensure we have fresh tokens
    try {
      const refreshSuccessful = await refreshSession();
      console.log('Session refresh result:', refreshSuccessful);
      
      // If session refresh failed but we thought we were logged in, show auth dialog
      if (!refreshSuccessful) {
        console.log('Session refresh failed, showing auth dialog');
        openAuthDialog();
        return;
      }
    } catch (err) {
      console.error('Error refreshing session:', err);
    }

    // Add the user message to the messages array
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input
    };

    // Create placeholder for assistant response
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: ''
    };

    // Clear the input field and update the messages state
    setInput('');
    setIsLoading(true);
    setMessages(prev => [...prev, userMessage, assistantMessage]);

    try {
      // Use abort controller to cancel the request if needed
      abortControllerRef.current = new AbortController();
      
      // Generate automatic chat thread title 
      const isFirstMessage = messages.length === 0;
      let threadTitle: string | undefined = undefined;
      
      if (isFirstMessage) {
        // Use the first 50 chars of the message as the title
        threadTitle = input.substring(0, 50) + (input.length > 50 ? '...' : '');
      }

      // Add selected model as system message for context
      const systemMessage = models.find(model => model.id === selectedModel);
      let modelName = systemMessage ? systemMessage.name : selectedModel;

      // Try to refresh the session before making API calls
      // This helps ensure the authentication token is valid
      if (user) {
        await refreshSession().catch(err => {
          console.log('Session refresh before API call failed:', err);
        });
      }

      // Fetch the response
      const { content, citations } = await fetchResponse(
        input,
        messages,
        selectedModel,
        abortControllerRef.current,
        (updatedMessages: Message[]) => {
          // This callback updates messages as they stream in
          setMessages(updatedMessages);
        },
        assistantMessage
      );

      // Update message with final response
      const finalMessages = [...messages, userMessage, {
        ...assistantMessage,
        content,
        citations,
        completed: true
      }];
      
      setMessages(finalMessages);

      // Create or update the thread only after we have the complete response
      if (isFirstMessage) {
        // For first message, queue a new thread creation (non-blocking)
        queueThreadSave({
          messages: finalMessages,
          title: threadTitle
        });
        
        // Still need to handle thread ID right away - can be estimated
        const tempThreadId = crypto.randomUUID();
        setCurrentThreadId(tempThreadId);
        
        // Update URL without forcing reload, we'll replace with real ID when save completes
        window.history.pushState({}, '', `/chat/${tempThreadId}`);
      } else if (currentThreadId) {
        // For subsequent messages, queue update of existing thread (non-blocking)
        queueThreadSave({
          messages: finalMessages
        });
      } else {
        // Fallback case - queue a new thread creation
        queueThreadSave({
          messages: finalMessages,
          title: threadTitle
        });
      }
      
      // Reset loading state after successful response
      setIsLoading(false);
      abortControllerRef.current = null;
    } catch (error: any) {
      console.error('Error fetching response:', error);
      
      // Add the error message to the assistant's message
      const updatedMessages = [...messages];
      const assistantMessageIndex = updatedMessages.length - 1;
      
      // Check if it's an auth error
      if (
        (error.message && error.message.toLowerCase().includes('unauthorized')) ||
        (error.message && (error.message.includes('parse') || error.message.includes('JSON')))
      ) {
        await handleRequestError(error);
        
        // Update the message with auth error info
        updatedMessages[assistantMessageIndex] = {
          ...updatedMessages[assistantMessageIndex],
          content: 'I encountered an authentication error. Please try again after fixing your session.',
          completed: true
        };
      } else {
        // For other errors
        updatedMessages[assistantMessageIndex] = {
          ...updatedMessages[assistantMessageIndex],
          content: `Error: ${error.message || 'Something went wrong. Please try again.'}`,
          completed: true
        };
        
        toast.error('Error generating response');
      }
      
      setMessages(updatedMessages);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Derived variables
  const isExa = selectedModel === 'exa';
  const selectedModelObj = models.find(model => model.id === selectedModel);
  const hasMessages = messages.length > 0;

  // Get the provider name for the selected model
  const providerName = selectedModelObj?.provider || 'AI';

  const handleNewChat = () => {
    // Ensure we're at the top of the page
    window.scrollTo(0, 0);
    
    // Clear messages and reset state
    setMessages([]);
    setInput('');
    setCurrentThreadId(null);
    
    // Update router without full navigation for smoother transition
    window.history.pushState({}, '', '/');
  };

  const handleStartChat = () => {
    if (user) {
      router.push('/chat/new');
    } else {
      openAuthDialog();
    }
  };

  const handleCreateThread = async () => {
    try {
      router.push('/chat/new');
    } catch (error) {
      toast.error('Failed to create new thread');
    }
  };

  // Add this near the top of your component
  useEffect(() => {
    // Function to warm up API routes
    const warmupApiRoutes = async () => {
      console.log('Warming up API routes...');
      
      // Preload API client modules first to reduce cold start
      prefetchAll();
      
      // Define the API routes to warm up
      const apiRoutes = [
        '/api/groq',
        '/api/openrouter',
        '/api/gemini',
        '/api/exaanswer'
      ];
      
      // Create minimal requests for each endpoint with proper structure
      const warmupRequests = apiRoutes.map(route => {
        return fetch(route, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Warmup': 'true'
          },
          body: JSON.stringify({ 
            warmup: true,
            model: 'mistralai/mistral-small-3.1-24b-instruct:free' // Provide a valid model ID
          }),
          // Use a short timeout and don't wait for the response
          signal: AbortSignal.timeout(500)
        }).catch(() => {
          // Intentionally ignoring errors - we just want to trigger compilation
        });
      });
      
      // Execute all warmup requests in parallel but don't wait for them to complete
      // This prevents blocking the UI if any request is slow
      Promise.allSettled(warmupRequests);
    };
    
    // Execute the warmup immediately after initial render
    warmupApiRoutes();
  }, []);  // Empty dependency array ensures this runs once after initial render

  return (
    <main className="flex min-h-screen flex-col">
      
      <Header toggleSidebar={toggleSidebar} />
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onSignInClick={openAuthDialog}
        refreshTrigger={refreshSidebar}
      />
      
      {!hasMessages ? (
        <>
          <MobileSearchUI 
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            selectedModel={selectedModel}
            handleModelChange={handleModelChange}
            models={models}
            autoprompt={autoprompt}
            toggleAutoprompt={toggleAutoprompt}
            setInput={setInput}
            messages={messages}
            isExa={selectedModel.includes('exa')}
            providerName={selectedModel.includes('exa') ? 'Exa' : 'Groq'}
          />
          <DesktopSearchUI 
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            selectedModel={selectedModel}
            handleModelChange={handleModelChange}
            models={models}
            autoprompt={autoprompt}
            toggleAutoprompt={toggleAutoprompt}
            setInput={setInput}
            isExa={selectedModel.includes('exa')}
            providerName={selectedModel.includes('exa') ? 'Exa' : 'Groq'}
            messages={messages}
          />
        </>
      ) : (
        <>
          <ChatMessages 
            messages={messages} 
            isLoading={isLoading}
            selectedModel={selectedModel}
            selectedModelObj={selectedModelObj}
            isExa={isExa}
          />

          {hasMessages && (
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
          )}
        </>
      )}
    </main>
  );
}

// Main Page component with Suspense boundary
export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PageContent />
    </Suspense>
  );
}
 