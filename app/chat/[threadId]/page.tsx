'use client';

import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Message, Model, ModelType, FileAttachment } from '../../types';
import Header from '../../component/Header';
import ChatMessages from '../../component/ChatMessages';
import ChatInput, { ChatInputHandle } from '../../component/ChatInput';
import Sidebar from '../../component/Sidebar';
import { fetchResponse } from '../../api/apiService';
import modelsData from '../../../models.json';
import { AuthDialog } from '@/components/AuthDialog';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import QueryEnhancer from '../../component/QueryEnhancer';
import React from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { useSidebarPin } from '../../../context/SidebarPinContext';
import { QueryEnhancerProvider, useQueryEnhancer } from '@/context/QueryEnhancerContext';
import { db } from '@/lib/db';
import { id } from '@instantdb/react';

function ChatThreadPageContent({ threadId }: { threadId: string }) {
  const { data, isLoading: isThreadLoading, error } = db.useQuery({
    threads: {
      $: { where: { id: threadId } },
      messages: {},
    },
  });
  const thread = data?.threads[0];
  // Map messages to ensure role is typed correctly for Message
  const dbMessages: Message[] = (thread?.messages || []).map((msg: any) => ({
    ...msg,
    role: (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') ? msg.role : 'user',
    citations: msg.citations,
    completed: msg.completed,
    startTime: msg.startTime,
    endTime: msg.endTime,
    tps: msg.tps,
    mediaData: msg.mediaData,
    weatherData: msg.weatherData,
    images: msg.images,
    attachments: msg.attachments,
    provider: msg.provider,
    quotedText: msg.quotedText,
  }));

  // --- Local state for optimistic UI ---
  const [messages, setMessages] = useState<Message[]>(dbMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-2.0-flash');
  const [models, setModels] = useState<Model[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [refreshSidebar, setRefreshSidebar] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, isLoading: authLoading, openAuthDialog } = useAuth();
  const router = useRouter();
  const chatInputRef = useRef<ChatInputHandle>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [activeChatFiles, setActiveChatFiles] = useState<Array<{ name: string; type: string; uri: string }>>([]);
  const [chatInputHeightOffset, setChatInputHeightOffset] = useState(0);
  const [quotedText, setQuotedText] = useState('');
  const [retriedMessageId, setRetriedMessageId] = useState<string | null>(null);
  const { pinned, setPinned } = useSidebarPin();
  const { enhancerMode } = useQueryEnhancer();

  const isAuthenticated = !!user;

  // Sync local messages state with DB on thread load/change
  useEffect(() => {
    if (!isThreadLoading) {
      setMessages(dbMessages);
    }
  }, [threadId, data, isThreadLoading]);

  useEffect(() => {
    // Add models from different providers
    const allModels = [
      {
        id: 'exa',
        name: 'Exa Search',
        provider: 'Exa',
        providerId: 'exa',
        enabled: true,
        toolCallType: 'native',
        searchMode: true
      },
      ...modelsData.models.filter(model => ['groq', 'google', 'openrouter', 'cerebras', 'xai', 'together'].includes(model.providerId))
    ];
    setModels(allModels);
  }, []);

  useEffect(() => {
    if (thread) {
      setSelectedModel(thread.model as ModelType);
    }
  }, [thread]);

  // Step 5: Callback to handle file uploaded event from backend
  const handleFileUploaded = useCallback((fileInfo: { name: string; type: string; uri: string }) => {
    setActiveChatFiles(prev => {
      if (!prev.some(f => f.uri === fileInfo.uri)) {
        return [...prev, fileInfo];
      }
      return prev;
    });
  }, []);

  const removeActiveFile = useCallback((uri: string) => {
    setActiveChatFiles(prev => prev.filter(f => f.uri !== uri));
  }, []);

  const handleActiveFilesHeightChange = useCallback((height: number) => {
    setChatInputHeightOffset(height > 0 ? height + 8 : 0);
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
        chatInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement> | string) => {
    const value = typeof e === 'string' ? e : e.target.value;
    setInput(value);
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId as ModelType);
  };

  const toggleSidebar = () => {
    if (pinned) {
      setPinned(false);
    } else {
      setIsSidebarOpen(true);
    }
  };

  // --- MAIN SUBMIT HANDLER (Optimistic UI) ---
  const handleSubmit = async (e: React.FormEvent, files?: File[]) => {
    e.preventDefault();
    if ((!input.trim() && (!files || files.length === 0)) || isLoading) return;
    if (!isAuthenticated) {
      openAuthDialog();
      return;
    }
    const fullInput = quotedText ? `> ${quotedText.replace(/\n/g, '\n> ')}\n\n${input.trim()}` : input.trim();
    const userMessageId = id();
    const assistantMessageId = id();
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: fullInput,
      createdAt: new Date(),
      ...(quotedText ? { quotedText } : {}),
      ...(files && files.length > 0 ? { attachments: files.map(file => ({ name: file.name, type: file.type, size: file.size })) } : {})
    };
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '...',
      createdAt: new Date(Date.now() + 1000),
    };
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setQuotedText('');
    setIsLoading(true);
    abortControllerRef.current = new AbortController();
    try {
      const completedAssistantMessage = await fetchResponse(
        fullInput,
        [...messages, userMessage],
        selectedModel,
        abortControllerRef.current,
        (updatedMessages: Message[]) => {
          // Optionally stream updates
          setMessages(updatedMessages);
        },
        assistantMessage,
        files,
        activeChatFiles,
        handleFileUploaded,
        enhancerMode,
      );
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessage.id ? { ...completedAssistantMessage, id: assistantMessage.id } : msg
      ));
      // Persist both messages to InstantDB
      await db.transact([
        db.tx.messages[userMessageId].update({
          role: userMessage.role,
          content: userMessage.content,
          createdAt: userMessage.createdAt ? (typeof userMessage.createdAt === 'string' ? userMessage.createdAt : userMessage.createdAt.toISOString()) : undefined,
          citations: userMessage.citations,
          completed: userMessage.completed,
          startTime: userMessage.startTime,
          endTime: userMessage.endTime,
          tps: userMessage.tps,
          mediaData: userMessage.mediaData,
          weatherData: userMessage.weatherData,
          images: userMessage.images,
          attachments: userMessage.attachments,
          provider: userMessage.provider,
          quotedText: userMessage.quotedText,
        }).link({ thread: threadId }),
        db.tx.messages[assistantMessageId].update({
          role: 'assistant',
          content: completedAssistantMessage.content,
          createdAt: new Date().toISOString(),
          citations: completedAssistantMessage.citations,
          completed: completedAssistantMessage.completed,
          startTime: completedAssistantMessage.startTime,
          endTime: completedAssistantMessage.endTime,
          tps: completedAssistantMessage.tps,
          mediaData: completedAssistantMessage.mediaData,
          weatherData: completedAssistantMessage.weatherData,
          images: completedAssistantMessage.images,
          attachments: completedAssistantMessage.attachments,
          provider: completedAssistantMessage.provider,
          quotedText: completedAssistantMessage.quotedText,
        }).link({ thread: threadId }),
        db.tx.threads[threadId].update({ updatedAt: new Date().toISOString() }),
      ]);
    } catch (error: any) {
      const errorMessage = error.message || 'Sorry, something went wrong.';
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessage.id ? { ...msg, content: errorMessage } : msg
      ));
      await db.transact([
        db.tx.messages[assistantMessageId].update({
          content: errorMessage,
          createdAt: new Date().toISOString(),
        })
      ]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleNewChat = () => {
    router.push('/');
    // Step 5: Clear active files (will be handled by navigating to home/new chat)
    setActiveChatFiles([]);
  };

  // Determine if the selected model is Exa
  const isExa = selectedModel === 'exa';

  // Get the provider name for the selected model
  const selectedModelObj = models.find(model => model.id === selectedModel);

  // Retry logic: fill input, remove old user+assistant pair, focus input
  const handleRetryMessage = useCallback((message: Message) => {
    if (message.role !== 'user') return;
    setInput(message.content || '');
    setQuotedText(message.quotedText || '');
    // This part needs to be adapted for InstantDB
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 100);
  }, []);

  // Auto-unpin sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1300 && pinned) setPinned(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pinned, setPinned]);

  // Always sort messages by createdAt ascending before rendering
  const sortedMessages = [...messages].sort((a, b) => {
    const aDate = new Date(a.createdAt || 0).getTime();
    const bDate = new Date(b.createdAt || 0).getTime();
    return aDate - bDate;
  });

  if (isThreadLoading || authLoading) {
    return (
      <div className={cn(
        pinned ? "ayle-grid-layout" : "",
        "min-h-screen w-full"
      )}>
        <main className={cn(
          "flex flex-col flex-1 min-h-screen",
          pinned ? "ayle-main-pinned" : ""
        )}>
        {/* Header - Mobile only */}
        <div className="lg:hidden">
          <Header toggleSidebar={toggleSidebar} />
        </div>
        {/* Fixed Ayle Logo - Desktop only */}
        <Link
          href="/"
            className={cn("hidden lg:flex fixed top-4 left-4 z-50 items-center transition-colors duration-200 hover:text-[#121212] dark:hover:text-[#ffffff]", pinned ? "sidebar-pinned-fixed" : "")}
          onClick={(e) => {
            e.preventDefault();
            window.location.href = '/';
          }}
        >
          <span 
            className="text-3xl text-[var(--brand-default)]"
            style={{ 
              fontFamily: 'var(--font-gebuk-regular)',
              letterSpacing: '0.05em',
              fontWeight: 'normal',
              position: 'relative',
              padding: '0 4px'
            }}
          >
            Ayle
          </span>
        </Link>
        <Sidebar
          isOpen={pinned || isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onSignInClick={openAuthDialog}
            refreshTrigger={refreshSidebar}
            pinned={pinned}
            setPinned={setPinned}
        />
        {/* ChatMessages skeleton or empty space while loading */}
          <div className="flex-1">
            {/* Optionally, you can add a skeleton here for ChatMessages */}
          </div>
          <ChatInput
            ref={chatInputRef}
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={(e) => handleSubmit(e, attachments)}
            isLoading={true} // Show loading state
            selectedModel={selectedModel}
            handleModelChange={handleModelChange}
            models={models}
            isExa={selectedModel === 'exa'}
            onNewChat={handleNewChat}
            onAttachmentsChange={setAttachments}
            activeChatFiles={activeChatFiles}
            removeActiveFile={removeActiveFile}
            onActiveFilesHeightChange={handleActiveFilesHeightChange}
            quotedText={quotedText}
            setQuotedText={setQuotedText}
            sidebarPinned={pinned}
          />
        {/* Fixed Theme Toggle - Desktop only, only for lg and up */}
          <div className={cn("hidden lg:block fixed bottom-4 left-4 z-50", pinned ? "sidebar-pinned-fixed" : "")}>
          <ThemeToggle />
        </div>
      </main>
      </div>
    );
  }

  return (
    <div className={cn(
      pinned ? "ayle-grid-layout" : "",
      "min-h-screen w-full"
    )}>
      <main className={cn(
        "flex flex-col flex-1 min-h-screen",
        pinned ? "ayle-main-pinned" : ""
      )}>
         {/* Header - Mobile only */}
<div className="lg:hidden">
  <Header toggleSidebar={toggleSidebar} />
</div>
{/* Fixed Ayle Logo - Desktop only */}
<Link
  href="/"
          className={cn("hidden lg:flex fixed top-4 left-4 z-50 items-center transition-colors duration-200 hover:text-[#121212] dark:hover:text-[#ffffff]", pinned ? "sidebar-pinned-fixed" : "")}
  onClick={(e) => {
    e.preventDefault();
    window.location.href = '/';
  }}
>
  <span 
    className="text-3xl text-[var(--brand-default)]"
    style={{ 
      fontFamily: 'var(--font-gebuk-regular)',
      letterSpacing: '0.05em',
      fontWeight: 'normal',
      position: 'relative',
      padding: '0 4px'
    }}
  >
    Ayle
  </span>
</Link>
      <Sidebar
        isOpen={pinned || isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSignInClick={openAuthDialog}
        refreshTrigger={refreshSidebar}
          pinned={pinned}
          setPinned={setPinned}
      />

      <ChatMessages
        messages={sortedMessages}
        isLoading={isLoading}
        selectedModel={selectedModel}
        selectedModelObj={selectedModelObj}
        isExa={selectedModel === 'exa'}
        currentThreadId={threadId}
        threadTitle={thread?.title}
        bottomPadding={chatInputHeightOffset}
        onQuote={setQuotedText}
        onRetry={handleRetryMessage}
      />

      <ChatInput
        ref={chatInputRef}
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={(e) => handleSubmit(e, attachments)}
        isLoading={isLoading}
        selectedModel={selectedModel}
        handleModelChange={handleModelChange}
        models={models}
        isExa={selectedModel === 'exa'}
        onNewChat={handleNewChat}
        onAttachmentsChange={setAttachments}
        activeChatFiles={activeChatFiles}
        removeActiveFile={removeActiveFile}
        onActiveFilesHeightChange={handleActiveFilesHeightChange}
        quotedText={quotedText}
        setQuotedText={setQuotedText}
          sidebarPinned={pinned}
      />

      {/* Auth Dialog */}
      <AuthDialog
        onSuccess={() => {
          setRefreshSidebar(prev => prev + 1);
        }}
      />
      {/* Fixed Theme Toggle - Desktop only, only for lg and up */}
        <div className={cn("hidden lg:block fixed bottom-4 left-4 z-50", pinned ? "sidebar-pinned-fixed" : "")}>
        <ThemeToggle />
      </div>
    </main>
    </div>
  );
}

export default function ChatThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = React.use(params);
  return (
    <QueryEnhancerProvider>
      <Suspense fallback={<div>Loading...</div>}>
        <ChatThreadPageContent threadId={threadId} />
      </Suspense>
    </QueryEnhancerProvider>
  )
} 