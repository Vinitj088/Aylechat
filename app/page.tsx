'use client';

import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Model, ModelType } from './types';
import Header from './component/Header';
import dynamic from 'next/dynamic';
import { ChatInputHandle } from './component/ChatInput';
import MobileSearchUI from './component/MobileSearchUI';
import DesktopSearchUI from './component/DesktopSearchUI';
import Sidebar from './component/Sidebar';
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
import { useChat, type Message as UIMessage } from '@ai-sdk/react';

// Import prompt-kit components
import { ChatContainer } from '@/components/ui/chat-container';
import { Message } from '@/components/ui/message';
import { PromptInput, PromptInputTextarea, PromptInputActions, PromptInputAction } from '@/components/ui/prompt-input';
import { Loader } from '@/components/ui/loader';
import { ScrollButton } from '@/components/ui/scroll-button';

// Lazy load heavy components
const ChatMessages = dynamic(() => import('./component/ChatMessages'), {
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  ),
  ssr: false
});

const DynamicChatInput = dynamic(() => import('./component/ChatInput'), {
  ssr: false
});

const DynamicSidebar = dynamic(() => import('./component/Sidebar'), {
  ssr: false
});

// Create a new component that uses useSearchParams
function PageContent() {
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-2.0-flash');
  const [models, setModels] = useState<Model[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [refreshSidebar, setRefreshSidebar] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, session, isLoading: authLoading, openAuthDialog } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Refs for ScrollButton
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null); // Ref for the bottom of messages list

  const isAuthenticated = !!user;

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: handleSubmitFromHook,
    isLoading,
    error,
    setMessages,
    append,
    reload,
    stop,
  } = useChat({
    api: '/api/chat',
    initialMessages: [],
    id: currentThreadId ?? undefined,
    sendExtraMessageFields: true,
    body: {
      model: selectedModel,
    },
    onError: (err) => {
      console.error('Chat hook error:', err);
      handleRequestError(err);
    },
  });

  // Prefetch API modules and data when the app loads
  useEffect(() => {
    prefetchAll().catch(() => {
      // Silently ignore prefetch errors as this is just an optimization
    });
  }, []);

  // Check URL parameters for auth dialog control
  useEffect(() => {
    const authRequired = searchParams.get('authRequired');
    const expired = searchParams.get('expired');
    const errorParam = searchParams.get('error');
    const sessionError = searchParams.get('session_error');
    const cookieError = searchParams.get('cookie_error');
    
    if (authRequired === 'true' || expired === 'true' || errorParam) {
      openAuthDialog();
      
      if (expired === 'true') {
        toast.error('Your session has expired. Please sign in again.');
      }
      
      if (errorParam) {
        toast.error('Authentication error. Please sign in again.');
      }
      
      const url = new URL(window.location.href);
      url.searchParams.delete('authRequired');
      url.searchParams.delete('expired');
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url);
    }

    if (sessionError === 'true' || cookieError === 'true') {
      toast.error('Session issue detected', {
        description: 'Please sign in again to get a fresh session',
        duration: 6000,
        action: {
          label: 'Sign In',
          onClick: () => {
            openAuthDialog();
          }
        }
      });
      
      const url = new URL(window.location.href);
      url.searchParams.delete('session_error');
      url.searchParams.delete('cookie_error');
      window.history.replaceState({}, '', url);
    }
  }, [searchParams, openAuthDialog]);

  useEffect(() => {
    if (searchParams.get('authRequired') === 'true') {
      openAuthDialog();
    }
  }, [searchParams, openAuthDialog]);

  useEffect(() => {
    const groqModels = modelsData.models.filter(model => model.providerId === 'groq');
    const googleModels = modelsData.models.filter(model => model.providerId === 'google');
    const openRouterModels = modelsData.models.filter(model => model.providerId === 'openrouter');
    const cerebrasModels = modelsData.models.filter(model => model.providerId === 'cerebras');
    
    const baseModels = modelsData.models.filter(model =>
      model.providerId !== 'exa'
    );
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
      ...cerebrasModels,
      ...openRouterModels,
      ...groqModels,
      ...baseModels
    ]);
    
    const searchParams = new URLSearchParams(window.location.search);
    const modelParam = searchParams.get('model');
    
    if (modelParam) {
      setSelectedModel(modelParam);
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('signIn') === 'true' || urlParams.get('auth') === 'true') {
      openAuthDialog();
    }
  }, [openAuthDialog]);
  
  useEffect(() => {
    if (messages.length === 0 && !isLoading) {
      const urlParams = new URLSearchParams(window.location.search);
      let searchQuery = urlParams.get('q');
      if (searchQuery && (searchQuery === '$1' || searchQuery === '%s')) {
        searchQuery = '';
      }

      if (searchQuery !== null) {
        const decodedQuery = decodeURIComponent(searchQuery);
        handleInputChange({ target: { value: decodedQuery } } as any);
        setSelectedModel('exa');

        const timer = setTimeout(async () => {
          if (decodedQuery.trim()) {
            const userMessage: UIMessage = {
              id: crypto.randomUUID(),
              role: 'user',
              content: decodedQuery
            };
            const assistantMessage: UIMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: ''
            };

            setMessages([userMessage, assistantMessage]);

            try {
              const controller = new AbortController();
              abortControllerRef.current = controller;
              
              // Use direct fetch for Exa search
              const response = await fetch('/api/exaanswer', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ query: decodedQuery, messages: [] }), // Sending empty messages for initial search
                  signal: controller.signal
              });
              if (!response.ok) {
                  // Try to parse error from body
                  let errorMsg = `Exa request failed with status ${response.status}`;
                  try {
                      const errorData = await response.json();
                      errorMsg = errorData.error || errorData.message || errorMsg;
                  } catch {}
                   throw new Error(errorMsg);
              }
              
              const data = await response.json(); 
              // Ensure data has expected structure, provide defaults
              const content = data?.answer || 'No answer found.'; 
              const citations = data?.results?.map((r: any) => ({ url: r.url, title: r.title })) || [];

              // Update messages state using setMessages from useChat
              setMessages(prevMessages => [
                  ...prevMessages.slice(0, -1), // Keep all messages except the last placeholder
                  {
                      ...assistantMessage,
                      content,
                      // TODO: Handle citations appropriately with UIMessage
                      // For now, maybe store in experimental_attachments or a custom field?
                      experimental_attachments: citations.map((c: { url: string, title: string }) => ({ 
                          contentType: 'exa/citation', 
                          name: c.title,
                          url: c.url 
                        })),
                     // completed: true // Not standard in UIMessage
                  }
              ]);
              
              abortControllerRef.current = null;
            } catch (error: any) {
              console.error('Error performing Exa search:', error);
              // Update the assistant message with the error
              setMessages(prevMessages => [
                  ...prevMessages.slice(0, -1), // Keep all messages except the last placeholder
                  {
                      ...assistantMessage,
                      content: `Error: ${error.message || 'Failed to perform search.'}`, 
                     // completed: true
                  }
              ]);
              abortControllerRef.current = null;
            }
          }
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]); // Depend on isLoading from useChat to avoid running if already loading

  const handleLoginClick = useCallback(() => {
    openAuthDialog();
  }, [openAuthDialog]);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId as ModelType);
  };

  const handleAuthSuccess = async () => {
    setRefreshSidebar(prev => prev + 1);
    if (input.trim()) {
      setTimeout(() => {
        const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
        handleSubmitFromHook(fakeEvent);
      }, 300);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      setRefreshSidebar(prev => prev + 1);
    }
  }, [isAuthenticated]);

  const handleRequestError = async (error: Error) => {
    if (
      error.message.includes('authentication') || 
      error.message.includes('Authentication') || 
      error.message.includes('auth') || 
      error.message.includes('Auth') ||
      error.message.includes('401') ||
      error.message.includes('Unauthorized')
    ) {
      openAuthDialog();
    } else if (error.message.includes('Rate limit')) {
      toast.error('RATE LIMIT', {
        description: `Please wait a moment before trying again`,
        duration: 5000,
      });
    } else {
      toast.error('Error Processing Request', {
        description: error.message || 'Please try again later',
        duration: 5000,
      });
    }
  };

  const createOrUpdateThread = async (threadContent: { messages: UIMessage[], title?: string }) => {
    if (!isAuthenticated || !user) {
      openAuthDialog();
      return null;
    }

    try {
      const method = currentThreadId ? 'PUT' : 'POST';
      const endpoint = currentThreadId 
        ? `/api/chat/threads/${currentThreadId}` 
        : '/api/chat/threads';
      
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
          messages: threadContent.messages,
          title: threadContent.title,
          model: selectedModel
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          openAuthDialog();
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.thread) {
        if (!currentThreadId) {
          setCurrentThreadId(result.thread.id);
          
          window.history.pushState({}, '', `/chat/${result.thread.id}`);
        }
        
        setRefreshSidebar(prev => prev + 1);
        
        return result.thread.id;
      }
      
      return null;
    } catch (error: any) {
      console.error('Error saving thread:', error);
      
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

  const isExa = selectedModel === 'exa';
  const selectedModelObj = models.find(model => model.id === selectedModel);
  const hasMessages = messages.length > 0;
  const providerName = selectedModelObj?.provider || 'AI';

  const handleNewChat = () => {
    window.scrollTo(0, 0);
    setMessages([]);
    handleInputChange({ target: { value: '' } } as any);
    setCurrentThreadId(null);
    window.history.pushState({}, '', '/');
    stop();
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

  useEffect(() => {
    const warmupApiRoutes = async () => {
      console.log('Warming up API routes...');
      
      prefetchAll();
      
      const apiRoutes = [
        '/api/groq',
        '/api/openrouter',
        '/api/gemini',
        '/api/exaanswer'
      ];
      
      const warmupRequests = apiRoutes.map(route => {
        return fetch(route, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Warmup': 'true'
          },
          body: JSON.stringify({ 
            warmup: true,
            model: 'mistralai/mistral-small-3.1-24b-instruct:free'
          }),
          signal: AbortSignal.timeout(500)
        }).catch(() => {
          // Intentionally ignoring errors - we just want to trigger compilation
        });
      });
      
      Promise.allSettled(warmupRequests);
    };
    
    warmupApiRoutes();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === '/' && !isLoading) {
        e.preventDefault();
        // Focus prompt-kit input - might need a ref or specific method
        // document.getElementById('prompt-input-id')?.focus(); // Example
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading]);

  useEffect(() => {
    router.prefetch('/chat');
    router.prefetch('/auth');
    
    if (user) {
      const recentThreads = localStorage.getItem('recentThreads');
      if (recentThreads) {
        JSON.parse(recentThreads).forEach((threadId: string) => {
          router.prefetch(`/chat/${threadId}`);
        });
      }
    }
  }, [user, router]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <main className="flex min-h-screen flex-col">
      
      <Header
        toggleSidebar={toggleSidebar}
      />
      <DynamicSidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSignInClick={openAuthDialog}
        refreshTrigger={refreshSidebar}
      />
      
      <ChatContainer ref={chatContainerRef} className="flex-1 flex flex-col py-4">
        <div className="flex-1 overflow-y-auto px-4 space-y-4">
          {messages.map(m => (
            <Message
              key={m.id}
              role={m.role}
            >
              {m.content}
            </Message>
          ))}
          {isLoading && (
            <div className="flex justify-center items-center p-4">
              <Loader />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <ScrollButton scrollRef={messagesEndRef} containerRef={chatContainerRef} />
        <div className="px-4 py-2 border-t">
          <PromptInput
            isLoading={isLoading}
            value={input}
            onValueChange={(newValue) => {
              const event = { target: { value: newValue } } as React.ChangeEvent<HTMLTextAreaElement>;
              handleInputChange(event);
            }}
            onSubmit={() => {
              const currentValue = input;
              if (!currentValue.trim() || isLoading) return;

              if (!isAuthenticated || !user) {
                openAuthDialog();
                return;
              }

              // Create user message object
              const userMessage: UIMessage = {
                id: crypto.randomUUID(), // Generate client-side ID
                role: 'user',
                content: currentValue,
              };

              // Append the message to trigger API call
              append(userMessage);

              // Manually clear input after appending
              // Note: useChat might clear input automatically on append/submit,
              // but let's clear it explicitly for safety.
              handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLTextAreaElement>);

              // TODO: Re-integrate Image Generation Logic if needed
            }}
          >
            <PromptInputTextarea
              placeholder="Type your message..."
            />
          </PromptInput>
        </div>
      </ChatContainer>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PageContent />
    </Suspense>
  );
}
 