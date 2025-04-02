'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { Message, Model, ModelType } from '../../types';
import Header from '../../component/Header';
import ChatMessages from '../../component/ChatMessages';
import ChatInput, { ChatInputHandle } from '../../component/ChatInput';
import Sidebar from '../../component/Sidebar';
import { fetchResponse } from '../../api/apiService';
import modelsData from '../../../models.json';
import { AuthDialog } from '@/components/AuthDialog';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ChatThread } from '@/lib/redis';
import { toast } from 'sonner';
import QueryEnhancer from '../../component/QueryEnhancer';
import React from 'react';

export default function ChatThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThreadLoading, setIsThreadLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-2.0-flash');
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [refreshSidebar, setRefreshSidebar] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, session } = useAuth();
  const router = useRouter();
  const threadId = React.use(params).threadId;
  const chatInputRef = useRef<ChatInputHandle>(null);

  const isAuthenticated = !!user;

  useEffect(() => {
    // Add models from different providers
    const groqModels = modelsData.models.filter(model => model.providerId === 'groq');
    const googleModels = modelsData.models.filter(model => model.providerId === 'google');
    const openRouterModels = modelsData.models.filter(model => model.providerId === 'openrouter');
    const cerebrasModels = modelsData.models.filter(model => model.providerId === 'cerebras');
    
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
      ...cerebrasModels,
      ...openRouterModels,
      ...groqModels,
    ]);
  }, []);

  useEffect(() => {
    const fetchThread = async () => {
      // Don't fetch if we already have the thread data
      if (thread && thread.id === threadId) {
        setIsThreadLoading(false);
        return;
      }

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
          if (response.status === 404 || response.status === 401) {
            // Thread not found or unauthorized - just mark as loaded
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
      } finally {
        setIsThreadLoading(false);
      }
    };

    if (threadId) {
      fetchThread();
    }
  }, [threadId, thread]);

  // Add global keyboard shortcut for focusing the chat input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if we're in an input field or textarea already
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      // Focus chat input when "/" is pressed
      if (e.key === '/' && !isLoading) {
        e.preventDefault();
        chatInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId as ModelType);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Block requests if user is not authenticated with just a toast
    if (!isAuthenticated) {
      toast.error('Please sign in to chat', {
        description: 'You can sign in using the sidebar or homepage'
      });
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

    // Find the selected model object to check its capabilities
    const modelObj = models.find(m => m.id === selectedModel);
    const isImageGenerationModel = modelObj?.imageGenerationMode === true;

    try {
      // Check if it's a new thread or existing thread
      const isNewThread = !threadId || threadId === 'new';
      
      // First, let's update the thread on the server
      if (user && isAuthenticated) {
        await updateThread(updatedMessages);
      }

      if (isImageGenerationModel) {
        // Handle image generation model
        const response = await fetch('/api/gemini', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          credentials: 'include',
          body: JSON.stringify({
            query: userMessage.content,
            model: selectedModel,
            messages: updatedMessages.slice(0, -1) // Exclude the empty assistant message
          })
        });

        if (!response.ok) {
          throw new Error(`Response error: ${response.status}`);
        }

        const data = await response.json();
        
        // Debug the response
        console.log('Image generation client response:', {
          hasText: !!data.text,
          textLength: data.text?.length || 0,
          hasImages: !!data.images,
          imagesCount: data.images?.length || 0
        });

        // Verify images array is valid
        if (data.images && Array.isArray(data.images)) {
          console.log(`Received ${data.images.length} images from API`);
        } else {
          console.error('No valid images array in response:', data);
          data.images = []; // Ensure we have a valid array
        }
        
        // Update the assistant message with text and images
        const completedAssistantMessage: Message = {
          ...assistantMessage,
          content: data.text || 'Here is the generated image:',
          images: data.images || [],
          completed: true
        };
        
        // Debug the message being added
        console.log('Adding assistant message with images:', {
          messageId: completedAssistantMessage.id,
          hasImages: !!completedAssistantMessage.images,
          imagesCount: completedAssistantMessage.images?.length || 0
        });

        // Update messages state with completed response
        setMessages(prevMessages => {
          const updatedMessages = prevMessages.map(msg => 
            msg.id === assistantMessage.id 
              ? completedAssistantMessage
              : msg
          );
          
          // Log final message count
          console.log(`Updated messages array now has ${updatedMessages.length} messages`);
          return updatedMessages;
        });

        // Update the thread again with the completed response
        if (user && isAuthenticated) {
          try {
            // Create a complete array with all messages including the completed response
            const finalMessages = [...messages]; // Start with previous messages
            
            // Find if user message is already in the array, add if not
            const userMessageExists = finalMessages.some(msg => msg.id === userMessage.id);
            if (!userMessageExists) {
              finalMessages.push(userMessage);
            }
            
            // Add or update the assistant message
            const assistantIndex = finalMessages.findIndex(msg => msg.id === assistantMessage.id);
            if (assistantIndex !== -1) {
              finalMessages[assistantIndex] = completedAssistantMessage;
            } else {
              finalMessages.push(completedAssistantMessage);
            }
            
            // Update thread with all messages
            await updateThread(finalMessages);
          } catch (updateError) {
            console.error('Error saving completed thread:', updateError);
          }
        }
      } else {
        // Standard text model processing
        let content = "";
        let citations: any[] = [];
        
        // Fetch the model response
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

        // Update the thread again with the completed response
        if (user && isAuthenticated) {
          try {
            // Create a complete array with all messages including the completed response
            const finalMessages = [...messages]; // Start with previous messages
            
            // Find if user message is already in the array, add if not
            const userMessageExists = finalMessages.some(msg => msg.id === userMessage.id);
            if (!userMessageExists) {
              finalMessages.push(userMessage);
            }
            
            // Find if assistant message exists, update it or add it
            const assistantIndex = finalMessages.findIndex(msg => msg.id === assistantMessage.id);
            if (assistantIndex !== -1) {
              finalMessages[assistantIndex] = {
                ...assistantMessage,
                content,
                citations,
                completed: true
              };
            } else {
              finalMessages.push({
                ...assistantMessage,
                content,
                citations,
                completed: true
              });
            }
            
            // Log message count for debugging
            console.log(`Saving thread with ${finalMessages.length} messages`);
            
            // Update thread with all messages
            await updateThread(finalMessages);
          } catch (updateError) {
            console.error('Error saving completed thread:', updateError);
          }
        }
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

  // Update thread in database
  const updateThread = async (updatedMessages: Message[]) => {
    if (!isAuthenticated || !user || !threadId) {
      return false;
    }
    
    try {
      // Add timestamp to prevent caching
      const timestamp = Date.now();
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
      
      if (!response.ok) {
        if (response.status === 401) {
          // No need to refresh, just show auth dialog
          setShowAuthDialog(true);
          setIsThreadLoading(false);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        // Update sidebar to reflect changes
        setRefreshSidebar(prev => prev + 1);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating thread:', error);
      return false;
    }
  };

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
        ref={chatInputRef}
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