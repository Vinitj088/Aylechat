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

// Create a new component that uses useSearchParams
function PageContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('exa');
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
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showAuthRequiredModal, setShowAuthRequiredModal] = useState<boolean>(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [refreshSidebar, setRefreshSidebar] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, session, isLoading: authLoading, openAuthDialog } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isAuthenticated = !!user;

  // Check URL parameters for auth dialog control
  useEffect(() => {
    const authRequired = searchParams.get('authRequired');
    const expired = searchParams.get('expired');
    const error = searchParams.get('error');
    const sessionError = searchParams.get('session_error');
    const cookieError = searchParams.get('cookie_error');
    
    // Show auth dialog if any of these params are present
    if (authRequired === 'true' || expired === 'true' || error) {
      setShowAuthDialog(true);
      
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
                setShowAuthDialog(true);
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
  }, [searchParams]);

  // Check for authRequired query param
  useEffect(() => {
    if (searchParams.get('authRequired') === 'true') {
      setShowAuthRequiredModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    // Add Exa as the first option and then add all Groq models
    const groqModels = modelsData.models.filter(model => model.providerId === 'groq');
    setModels(prevModels => [...prevModels, ...groqModels]);
  }, []);

  // Handle showing the auth dialog if opened via URL param
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('signIn') === 'true' || urlParams.get('auth') === 'true') {
      openAuthDialog();
    }
  }, [openAuthDialog]);

  // Set up auth dialog control functions
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  
  // Register the dialog open function
  useEffect(() => {
    // Just use the openAuthDialog function directly
    const showAuthDialog = () => {
      setIsAuthDialogOpen(true);
    };
    
    // In a real implementation, you would register this with a global
    // event system or context, but for now we'll just use the state directly
  }, []);

  // Function to handle login button click
  const handleLoginClick = useCallback(() => {
    openAuthDialog();
  }, [openAuthDialog]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value as ModelType);
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
      setShowAuthDialog(true);
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

  const createOrUpdateThread = async (threadContent: { messages: Message[], title?: string }) => {
    if (!isAuthenticated || !user) {
      // Show auth dialog instead of redirecting
      setShowAuthDialog(true);
      return null;
    }

    try {
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

      if (!response.ok) {
        if (response.status === 401) {
          // Auth error - show auth dialog
          setShowAuthDialog(true);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // If not authenticated, show auth dialog and keep the message in the input
    if (!isAuthenticated || !user) {
      setShowAuthDialog(true);
      return;
    }

    // Prevent submitting if auth dialog is open
    if (showAuthDialog) {
      return;
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
        citations
      }];
      
      setMessages(finalMessages);

      // Create or update the thread only after we have the complete response
      if (isFirstMessage) {
        // For first message, create a new thread
        const threadId = await createOrUpdateThread({
          messages: finalMessages,
          title: threadTitle
        });
        
        if (threadId) {
          setCurrentThreadId(threadId);
          // Update the URL to the new thread without forcing a reload
          window.history.pushState({}, '', `/chat/${threadId}`);
        }
      } else if (currentThreadId) {
        // For subsequent messages, update the existing thread
        await createOrUpdateThread({
          messages: finalMessages
        });
      } else {
        // If we somehow don't have a thread ID, create a new thread
        const threadId = await createOrUpdateThread({
          messages: finalMessages,
          title: threadTitle
        });
        
        if (threadId) {
          setCurrentThreadId(threadId);
          // Update the URL to the new thread without forcing a reload
          window.history.pushState({}, '', `/chat/${threadId}`);
        }
      }
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
          content: 'I encountered an authentication error. Please try again after fixing your session.'
        };
      } else {
        // For other errors
        updatedMessages[assistantMessageIndex] = {
          ...updatedMessages[assistantMessageIndex],
          content: `Error: ${error.message || 'Something went wrong. Please try again.'}`
        };
        
        toast.error('Error generating response');
      }
      
      setMessages(updatedMessages);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Determine if we have any messages
  const hasMessages = messages.length > 0;

  // Determine if the selected model is Exa
  const isExa = selectedModel === 'exa';

  // Get the provider name for the selected model
  const selectedModelObj = models.find(model => model.id === selectedModel);
  const providerName = selectedModelObj?.provider || 'AI';

  const handleNewChat = () => {
    setMessages([]);
    setInput('');
    setCurrentThreadId(null);
    router.push('/');
  };

  const handleStartChat = () => {
    if (user) {
      router.push('/chat/new');
    } else {
      setShowAuthDialog(true);
    }
  };

  const handleCreateThread = async () => {
    try {
      router.push('/chat/new');
    } catch (error) {
      toast.error('Failed to create new thread');
    }
  };

  return (
    <main className="flex min-h-screen flex-col">
      
      <Header toggleSidebar={toggleSidebar} />
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onSignInClick={() => setShowAuthDialog(true)}
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

          {/* Input Form - Only show when there are messages */}
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

      {/* Auth Dialog */}
      <AuthDialog 
        isOpen={showAuthDialog}
        onClose={() => setShowAuthDialog(false)}
        onSuccess={handleAuthSuccess}
      />
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
 