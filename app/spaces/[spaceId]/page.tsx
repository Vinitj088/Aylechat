'use client';

import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Message, Model, ModelType } from '@/app/types';
import Header from '@/app/component/Header';
import dynamic from 'next/dynamic';
import { ChatInputHandle } from '@/app/component/ChatInput';
import Sidebar from '@/app/component/Sidebar';
import { fetchResponse } from '@/app/api/apiService';
import modelsData from '@/models.json';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import Link from 'next/link';
import { prefetchAll } from '@/app/api/prefetch';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useThreadCache } from '@/context/ThreadCacheContext';
import { cn } from '@/lib/utils';
import { useSidebarPin } from '@/context/SidebarPinContext';
import { spaces } from '../config';

const ChatMessages = dynamic(() => import('@/app/component/ChatMessages'), {
  loading: () => <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>,
  ssr: false
});
const DynamicChatInput = dynamic(() => import('@/app/component/ChatInput'), { ssr: false });
const DynamicSidebar = dynamic(() => import('@/app/component/Sidebar'), { ssr: false });

function SpaceChatPageContent({ params }: { params: { spaceId: string } }) {
  const space = spaces[params.spaceId];
  
  const systemPromptMessage: Message = {
      id: 'system-prompt',
      role: 'system',
      content: space.systemPrompt,
  };

  const [messages, setMessages] = useState<Message[]>([systemPromptMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-2.0-flash');
  const [models, setModels] = useState<Model[]>([]);
  const { pinned, setPinned } = useSidebarPin();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [refreshSidebar, setRefreshSidebar] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, openAuthDialog } = useAuth();
  const router = useRouter();
  const chatInputRef = useRef<ChatInputHandle>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [activeChatFiles, setActiveChatFiles] = useState<Array<{ name: string; type: string; uri: string }>>([]);
  const [chatInputHeightOffset, setChatInputHeightOffset] = useState(0);
  const { addThread } = useThreadCache();
  const [quotedText, setQuotedText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isAuthenticated = !!user;

  useEffect(() => {
    prefetchAll().catch(() => {});
    setModels(modelsData.models);
  }, []);
  
  const handleFileUploaded = useCallback((fileInfo: { name: string; type: string; uri: string }) => {
    setActiveChatFiles(prev => !prev.some(f => f.uri === fileInfo.uri) ? [...prev, fileInfo] : prev);
  }, []);

  const removeActiveFile = useCallback((uri: string) => {
    setActiveChatFiles(prev => prev.filter(f => f.uri !== uri));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;
    if (!isAuthenticated) {
      openAuthDialog();
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      ...(quotedText && { quotedText })
    };
    if (attachments.length > 0) {
      userMessage.attachments = attachments.map(f => ({ name: f.name, type: f.type, size: f.size }));
    }

    const assistantMessage: Message = { id: `ai-${Date.now()}`, role: 'assistant', content: '...' };
    
    const newMessages = [...messages, userMessage, assistantMessage];
    setMessages(newMessages);
    setInput('');
    setQuotedText('');
    setIsLoading(true);

    try {
      abortControllerRef.current = new AbortController();
      const isFirstMessage = messages.length === 1;

      const completedAssistantMessage = await fetchResponse(
        input,
        newMessages.slice(0, -1),
        selectedModel,
        abortControllerRef.current,
        setMessages,
        assistantMessage,
        attachments,
        activeChatFiles,
        handleFileUploaded
      );

      setMessages(prev => prev.map(msg => msg.id === assistantMessage.id ? completedAssistantMessage : msg));

      const finalMessagesForThread = [...newMessages.slice(0, -1), completedAssistantMessage];
      
      if (isFirstMessage) {
        const threadId = await createOrUpdateThread({ messages: finalMessagesForThread });
        if (threadId) {
            setCurrentThreadId(threadId);
            router.push(`/chat/${threadId}`);
        }
      } else if (currentThreadId) {
        await createOrUpdateThread({ messages: finalMessagesForThread });
      }
      
    } catch (error: any) {
      toast.error('Error generating response', { description: error.message });
      setMessages(prev => prev.slice(0, -1)); 
    } finally {
        setIsLoading(false);
        setAttachments([]);
        abortControllerRef.current = null;
    }
  };

  const createOrUpdateThread = async (threadContent: { messages: Message[], title?: string }) => {
    if (!isAuthenticated) return null;
    try {
      const method = currentThreadId ? 'PUT' : 'POST';
      const endpoint = currentThreadId ? `/api/chat/threads/${currentThreadId}` : '/api/chat/threads';
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        credentials: 'include',
        body: JSON.stringify({ ...threadContent, model: selectedModel })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      if (result.success && result.thread) {
        if (!currentThreadId) addThread(result.thread);
        return result.thread.id;
      }
      return null;
    } catch (error) {
      toast.error('Error saving conversation');
      return null;
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement> | string) => setInput(typeof e === 'string' ? e : e.target.value);
  const handleModelChange = (modelId: string) => setSelectedModel(modelId as ModelType);
  const toggleSidebar = () => setPinned(!pinned);
  const handleActiveFilesHeightChange = useCallback((height: number) => setChatInputHeightOffset(height > 0 ? height + 8 : 0), []);
  const handleRetryMessage = useCallback((message: Message) => {
    if (message.role !== 'user') return;
    setInput(message.content || '');
    setQuotedText(message.quotedText || '');
    setMessages(prev => prev.slice(0, prev.findIndex(m => m.id === message.id)));
    setTimeout(() => chatInputRef.current?.focus(), 100);
  }, []);
  const handleNewChat = () => router.push('/spaces');

  const selectedModelObj = models.find(model => model.id === selectedModel);

  if (!space) {
    return <div>Space not found</div>;
  }

  return (
    <div className={cn(pinned ? "ayle-grid-layout" : "", "min-h-screen w-full")}>
      <main className={cn("flex flex-col flex-1 min-h-screen", pinned ? "ayle-main-pinned" : "")}>
        <div className="lg:hidden"><Header toggleSidebar={() => setIsSidebarOpen(true)} /></div>
        <Link href="/" className={cn("hidden lg:flex fixed top-4 left-4 z-50", pinned ? "sidebar-pinned-fixed" : "")}>
          <span className="text-3xl text-[var(--brand-default)]" style={{ fontFamily: 'var(--font-gebuk-regular)', letterSpacing: '0.05em' }}>Ayle</span>
        </Link>
        <DynamicSidebar isOpen={pinned || isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onSignInClick={openAuthDialog} refreshTrigger={refreshSidebar} pinned={pinned} setPinned={setPinned} />
        
        <div className="flex-1 flex flex-col overflow-hidden">
            <ChatMessages 
              messages={messages} 
              isLoading={isLoading}
              selectedModel={selectedModel}
              selectedModelObj={selectedModelObj}
              isExa={false}
              currentThreadId={currentThreadId}
              bottomPadding={chatInputHeightOffset}
              onQuote={setQuotedText}
              onRetry={handleRetryMessage}
            />
          <div className="w-full">
            <DynamicChatInput 
                ref={chatInputRef}
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                isLoading={isLoading}
                selectedModel={selectedModel}
                handleModelChange={handleModelChange}
                models={models}
                isExa={false}
                onNewChat={handleNewChat}
                onAttachmentsChange={setAttachments}
                activeChatFiles={activeChatFiles}
                removeActiveFile={removeActiveFile}
                onActiveFilesHeightChange={handleActiveFilesHeightChange}
                quotedText={quotedText}
                setQuotedText={setQuotedText}
                sidebarPinned={pinned}
              />
          </div>
        </div>
        
        <div className={cn("hidden lg:block fixed bottom-4 left-4 z-50", pinned ? "sidebar-pinned-fixed" : "")}><ThemeToggle /></div>
      </main>
    </div>
  );
}

export default function SpaceChatPage({ params }: { params: { spaceId: string } }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading Space...</div>}>
      <SpaceChatPageContent params={params} />
    </Suspense>
  );
} 