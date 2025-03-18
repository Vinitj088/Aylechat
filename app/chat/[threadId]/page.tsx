'use client';

import { useState, useRef, useEffect } from 'react';
import { Message, Model, ModelType } from '../../types';
import Header from '../../component/Header';
import ChatMessages from '../../component/ChatMessages';
import ChatInput from '../../component/ChatInput';
import Sidebar from '../../component/Sidebar';
import { fetchResponse } from '../../api/apiService';
import modelsData from '../../../models.json';
import AuthDialog from '@/components/AuthDialog';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ChatThread } from '@/lib/redis';

export default function ChatThreadPage({ params }: { params: { threadId: string } }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThreadLoading, setIsThreadLoading] = useState(true);
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, isAuthenticated, login, signup } = useAuth();
  const router = useRouter();
  const { threadId } = params;

  useEffect(() => {
    // Add Exa as the first option and then add all Groq models
    const groqModels = modelsData.models.filter(model => model.providerId === 'groq');
    setModels(prevModels => [...prevModels, ...groqModels]);
  }, []);

  useEffect(() => {
    const fetchThread = async () => {
      if (!isAuthenticated || !user) {
        setIsThreadLoading(false);
        return;
      }

      try {
        setIsThreadLoading(true);
        const response = await fetch(`/api/chat/threads/${threadId}`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            router.push('/');
            return;
          }
          
          if (response.status === 401) {
            // Don't redirect on auth error, just show empty state
            setIsThreadLoading(false);
            return;
          }
          
          throw new Error('Failed to fetch thread');
        }
        
        const data = await response.json();
        if (data.success && data.thread) {
          setThread(data.thread);
          setMessages(data.thread.messages);
        }
      } catch (error) {
        console.error('Error fetching thread:', error);
      } finally {
        setIsThreadLoading(false);
      }
    };

    fetchThread();
  }, [threadId, isAuthenticated, user, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value as ModelType);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

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

      // Create a copy of the messages and update it
      const updatedMessages = [...messages];
      const assistantIndex = updatedMessages.findIndex(m => m.id === assistantMessage.id);
      
      if (assistantIndex !== -1) {
        updatedMessages[assistantIndex] = { ...assistantMessage, content, citations };
      } else {
        updatedMessages.push(userMessage);
        updatedMessages.push({ ...assistantMessage, content, citations });
      }
      
      setMessages(updatedMessages);

      // Update the thread in Redis
      if (isAuthenticated && user) {
        await fetch(`/api/chat/threads/${threadId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify({ messages: updatedMessages }),
          credentials: 'include'
        });
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
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
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
        onLogin={login}
        onSignup={signup}
      />
    </main>
  );
} 