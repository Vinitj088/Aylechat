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

  // Simplified thread creation that only makes one API call
  const createOrUpdateThread = async (threadContent: { messages: Message[], title?: string }) => {
    if (!isAuthenticated || !user) return null;
    
    try {
      if (currentThreadId) {
        // Update existing thread
        const response = await fetch(`/api/chat/threads/${currentThreadId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          body: JSON.stringify({ messages: threadContent.messages }),
          credentials: 'include'
        });
        
        if (!response.ok) return null;
        
        return currentThreadId;
      } else {
        // Create new thread
        const title = threadContent.title || 'Chat Thread';
        const response = await fetch('/api/chat/threads', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          body: JSON.stringify({ 
            title, 
            messages: threadContent.messages 
          }),
          credentials: 'include'
        });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data.success) {
          // Trigger refresh after thread creation
          setRefreshSidebar(prev => prev + 1);
          return data.thread.id;
        }
        
        return null;
      }
    } catch (error) {
      console.error('Error with thread operation:', error);
      return null;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Show auth dialog if user is not authenticated
    if (!isAuthenticated) {
      setShowAuthDialog(true);
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim()
    };

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: ''
    };

    // Add messages to the UI
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      const { content, citations } = await fetchResponse(
        input,
        messages,
        selectedModel,
        abortControllerRef.current,
        setMessages,
        assistantMessage
      );

      // Create a new array with the updated messages
      const updatedMessages = [...messages];
      const assistantIndex = updatedMessages.findIndex(m => m.id === assistantMessage.id);
      
      if (assistantIndex !== -1) {
        // Update existing message
        updatedMessages[assistantIndex] = { ...assistantMessage, content, citations };
      } else {
        // Add as new messages
        updatedMessages.push(userMessage);
        updatedMessages.push({ ...assistantMessage, content, citations });
      }
      
      setMessages(updatedMessages);

      // Save to Redis only if authenticated
      if (isAuthenticated && user) {
        const title = messages.length === 0 ? input.slice(0, 50) : 'Chat Thread';
        
        const threadId = await createOrUpdateThread({ 
          title, 
          messages: updatedMessages 
        });
        
        if (threadId) {
          setCurrentThreadId(threadId);
          // No navigation - stay on the current page
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      console.error('Error:', error);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, content: 'Sorry, there was an error processing your request.' } 
            : msg
        )
      );
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
 