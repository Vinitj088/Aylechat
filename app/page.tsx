'use client';

import { useState, useRef, useEffect } from 'react';
import { Message, Model, ModelType } from './types';
import Header from './component/Header';
import ChatMessages from './component/ChatMessages';
import ChatInput from './component/ChatInput';
import MobileSearchUI from './component/MobileSearchUI';
import DesktopSearchUI from './component/DesktopSearchUI';
import Sidebar from './component/Sidebar';
import { fetchResponse } from './api/apiService';
import modelsData from '../models.json';
import AuthDialog from '@/components/AuthDialog';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Page() {
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
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [refreshSidebar, setRefreshSidebar] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, isAuthenticated, login, signup } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Add Exa as the first option and then add all Groq models
    const groqModels = modelsData.models.filter(model => model.providerId === 'groq');
    setModels(prevModels => [...prevModels, ...groqModels]);
  }, []);

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

  const handleLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
      setShowAuthDialog(false);
      
      // Process pending input after successful login
      if (input.trim()) {
        // Wait a bit for auth to complete
        setTimeout(() => {
          handleSubmit({ preventDefault: () => {} } as React.FormEvent);
        }, 300);
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const handleSignup = async (email: string, password: string, name: string) => {
    try {
      await signup(email, password, name);
      setShowAuthDialog(false);
      
      // Process pending input after successful signup
      if (input.trim()) {
        // Wait a bit for auth to complete
        setTimeout(() => {
          handleSubmit({ preventDefault: () => {} } as React.FormEvent);
        }, 300);
      }
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    }
  };

  // Triggered when authentication state changes - load threads
  useEffect(() => {
    if (isAuthenticated) {
      // Only trigger sidebar refresh on auth state change
      setRefreshSidebar(prev => prev + 1);
    }
  }, [isAuthenticated]);

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
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...threadContent,
          model: selectedModel
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Auth error - show auth dialog instead of redirecting
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
    } catch (error) {
      console.error('Error saving thread:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

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
      
      // Create or update the thread with the new messages
      const threadId = await createOrUpdateThread({
        messages: [...messages, userMessage, assistantMessage],
        title: threadTitle
      });
      
      // If thread creation failed due to auth, stop here
      if (!threadId && !isAuthenticated) {
        setIsLoading(false);
        return;
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
      setMessages(prev => {
        const updatedMessages = [...prev];
        const assistantIndex = updatedMessages.findIndex(m => m.id === assistantMessage.id);
        
        if (assistantIndex !== -1) {
          updatedMessages[assistantIndex] = { 
            ...assistantMessage, 
            content, 
            citations 
          };
        }
        
        return updatedMessages;
      });

      // Update the thread after completion
      if (threadId) {
        await createOrUpdateThread({
          messages: [...messages, userMessage, {
            ...assistantMessage,
            content,
            citations
          }],
          title: threadTitle
        });
      }
    } catch (error) {
      console.error('Error in chat submission:', error);
      setMessages(prev => {
        const assistantIndex = prev.findIndex(m => m.id === assistantMessage.id);
        
        if (assistantIndex !== -1) {
          // Update the assistant message with an error
          const updatedMessages = [...prev];
          updatedMessages[assistantIndex] = {
            ...assistantMessage,
            content: 'I encountered an error processing your request. Please try again.'
          };
          return updatedMessages;
        }
        
        // If assistant message not found, add an error message
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'I encountered an error processing your request. Please try again.'
          }
        ];
      });
    } finally {
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
        onLogin={handleLogin}
        onSignup={handleSignup}
      />
    </main>
  );
}
 