'use client';

import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Message, Model, ModelType, FileAttachment } from '../../types';
import Header from '../../component/Header';
import LeftSidebar from '../../component/LeftSidebar';
import ChatMessages from '../../component/ChatMessages';
import ChatInput, { ChatInputHandle } from '../../component/ChatInput';
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, isLoading: authLoading, openAuthDialog } = useAuth();
  const router = useRouter();
  const chatInputRef = useRef<ChatInputHandle>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [activeChatFiles, setActiveChatFiles] = useState<Array<{ name: string; type: string; uri: string }>>([]);
  const [chatInputHeightOffset, setChatInputHeightOffset] = useState(0);
  const [quotedText, setQuotedText] = useState('');
  const [retriedMessageId, setRetriedMessageId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sidebarMounted, setSidebarMounted] = useState(false);
  const { enhancerMode } = useQueryEnhancer();

  const isAuthenticated = !!user;

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebarExpanded');
    if (saved) {
      setIsExpanded(JSON.parse(saved));
    }
    setSidebarMounted(true);
  }, []);

  // Persist sidebar expanded state
  useEffect(() => {
    if (sidebarMounted) {
      localStorage.setItem('sidebarExpanded', JSON.stringify(isExpanded));
    }
  }, [isExpanded, sidebarMounted]);

  // Update document title when thread title is available
  useEffect(() => {
    if (!isThreadLoading && thread) {
      if (thread.title) {
        document.title = `${thread.title} - Ayle Chat`;
      } else {
        document.title = 'Ayle Chat';
      }
    }
  }, [thread, isThreadLoading]);

  // Sync local messages state with DB on thread load/change
  useEffect(() => {
    if (!isThreadLoading) {
      setMessages(dbMessages);
    }
  }, [threadId, data, isThreadLoading]);

  useEffect(() => {
    // Add models from different providers in a specific order
    const providerOrder = ['perplexity', 'google', 'cerebras', 'inception', 'groq', 'openrouter', 'together' ];
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
      ...providerOrder.flatMap(providerId =>
        modelsData.models.filter(model => model.providerId === providerId && model.enabled)
      )
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

  // --- MAIN SUBMIT HANDLER (Optimistic UI) ---
  const handleSubmit = async (e: React.FormEvent, files?: File[]) => {
    e.preventDefault();
    if ((!input.trim() && (!files || files.length === 0)) || isLoading) return;
    if (!isAuthenticated) {
      openAuthDialog();
      return;
    }
    // Only use the user's input as the message content; quotedText is shown in the custom UI, not as a blockquote
    const fullInput = input.trim();
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

  // Always sort messages by createdAt ascending before rendering
  const sortedMessages = [...messages].sort((a, b) => {
    const aDate = new Date(a.createdAt || 0).getTime();
    const bDate = new Date(b.createdAt || 0).getTime();
    return aDate - bDate;
  });

  if (isThreadLoading || authLoading) {
    return (
      <>
        {/* Mobile Header */}
        <div className="md:hidden">
          <Header onToggleSidebar={() => setIsExpanded(true)} />
        </div>

        {/* Desktop & Tablet Layout - Fixed sidebar */}
        <div className="hidden md:block h-screen overflow-hidden">
          {/* Left Sidebar - Tablet and Desktop */}
          <LeftSidebar
            onNewChat={handleNewChat}
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            isHydrating={!sidebarMounted}
          />

          {/* Main Content */}
          <div className={cn(
            "h-screen flex flex-col transition-all duration-300",
            isExpanded ? "ml-64" : "ml-14"
          )}>
            <div className="flex-1 overflow-y-auto">
              {/* Loading skeleton */}
            </div>
            <div className="flex-shrink-0 w-full bg-[var(--secondary-default)] z-10">
              <ChatInput
                ref={chatInputRef}
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={(e) => handleSubmit(e, attachments)}
                isLoading={true}
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
              />
            </div>
          </div>
        </div>

        {/* Mobile Content */}
        <div className="md:hidden h-screen flex flex-col overflow-hidden relative">
          {/* Mobile Left Sidebar - Overlay */}
          <LeftSidebar
            onNewChat={handleNewChat}
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            isHydrating={!sidebarMounted}
          />

          {/* Overlay backdrop when sidebar is expanded */}
          {isExpanded && (
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsExpanded(false)}
            />
          )}

          <div className="flex-1 overflow-y-auto">
            {/* Loading skeleton */}
          </div>
          <div className="flex-shrink-0 w-full bg-[var(--secondary-default)] z-10">
            <ChatInput
              ref={chatInputRef}
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={(e) => handleSubmit(e, attachments)}
              isLoading={true}
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
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden">
        <Header onToggleSidebar={() => setIsExpanded(true)} />
      </div>

      {/* Desktop & Tablet Layout - Fixed sidebar */}
      <div className="hidden md:block h-screen overflow-hidden">
        {/* Left Sidebar - Tablet and Desktop */}
        <LeftSidebar
          onNewChat={handleNewChat}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          isHydrating={!sidebarMounted}
        />

        {/* Main Content */}
        <div className={cn(
          "h-screen flex flex-col transition-all duration-300",
          isExpanded ? "ml-64" : "ml-14"
        )}>
          <div className="flex-1 overflow-y-auto">
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
          </div>

          <div className="flex-shrink-0 w-full bg-[var(--secondary-default)] z-10">
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
            />
          </div>
        </div>
      </div>

      {/* Mobile Content */}
      <div className="md:hidden h-screen flex flex-col overflow-hidden relative">
        {/* Mobile Left Sidebar - Overlay */}
        <LeftSidebar
          onNewChat={handleNewChat}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          isHydrating={!sidebarMounted}
        />

        {/* Overlay backdrop when sidebar is expanded */}
        {isExpanded && (
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsExpanded(false)}
          />
        )}

        <div className="flex-1 overflow-y-auto">
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
        </div>

        <div className="flex-shrink-0 w-full bg-[var(--secondary-default)] z-10">
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
          />
        </div>
      </div>

      {/* Auth Dialog */}
      <AuthDialog
        onSuccess={() => {
        }}
      />
    </>
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