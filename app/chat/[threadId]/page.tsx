'use client';

import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Message, Model, ModelType } from '../../types';
import Header from '../../component/Header';
import LeftSidebar from '../../component/LeftSidebar';
import ChatMessages from '../../component/ChatMessages';
import ChatInput, { ChatInputHandle } from '../../component/ChatInput';
import { useAyleChat } from '../../hooks/useAyleChat';
import modelsData from '../../../models.json';
import { AuthDialog } from '@/components/AuthDialog';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import React from 'react';
import { cn } from '@/lib/utils';
import { QueryEnhancerProvider } from '@/context/QueryEnhancerContext';
import { db } from '@/lib/db';
import { User, Clock, Link2, MoreHorizontal, Check, Pencil } from 'lucide-react';
import ShareButton from '../../component/ShareButton';
import { toast } from 'sonner';

function ChatThreadPageContent({ threadId }: { threadId: string }) {
  const { data, isLoading: isThreadLoading } = db.useQuery({
    threads: {
      $: { where: { id: threadId } },
      messages: {},
    },
  });
  const thread = data?.threads[0];

  // Map messages from DB to ensure proper typing
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

  // Local state
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-2.0-flash');
  const [models, setModels] = useState<Model[]>([]);
  const { user, isLoading: authLoading, openAuthDialog } = useAuth();
  const router = useRouter();
  const chatInputRef = useRef<ChatInputHandle>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [activeChatFiles, setActiveChatFiles] = useState<Array<{ name: string; type: string; uri: string }>>([]);
  const [chatInputHeightOffset, setChatInputHeightOffset] = useState(0);
  const [quotedText, setQuotedText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [sidebarMounted, setSidebarMounted] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const isAuthenticated = !!user;

  // Use the AI SDK powered chat hook
  const chat = useAyleChat({
    threadId,
    userId: user?.id || null,
    selectedModel,
    initialMessages: dbMessages,
  });

  // Sync messages from DB when thread data changes
  useEffect(() => {
    if (!isThreadLoading && dbMessages.length > 0 && chat.messages.length === 0) {
      // Messages will be synced through the hook's initialMessages
    }
  }, [isThreadLoading, dbMessages]);

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

  // Load models
  useEffect(() => {
    const providerOrder = ['perplexity', 'google', 'cerebras', 'inception', 'groq', 'openrouter', 'together'];
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

  // Set model from thread when loaded
  useEffect(() => {
    if (thread) {
      setSelectedModel(thread.model as ModelType);
    }
  }, [thread]);

  // Handle file uploaded event from backend
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

  // Keyboard shortcut for focusing input
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
      if (e.key === '/' && !chat.isLoading) {
        e.preventDefault();
        chatInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chat.isLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement> | string) => {
    const value = typeof e === 'string' ? e : e.target.value;
    chat.setInput(value);
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId as ModelType);
  };

  // Main submit handler using AI SDK
  const handleSubmit = async (e: React.FormEvent, files?: File[]) => {
    e.preventDefault();
    if ((!chat.input.trim() && (!files || files.length === 0)) || chat.isLoading) return;
    if (!isAuthenticated) {
      openAuthDialog();
      return;
    }

    const inputText = chat.input.trim();

    // Submit using the AI SDK hook
    await chat.submit(inputText, {
      attachments: files,
      quotedText: quotedText || undefined,
    });

    // Clear quoted text after submit
    setQuotedText('');
  };

  const handleNewChat = () => {
    router.push('/');
    setActiveChatFiles([]);
  };

  // Start editing title
  const handleStartEditTitle = () => {
    setEditedTitle(thread?.title || '');
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 50);
  };

  // Save edited title
  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || editedTitle === thread?.title) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await db.transact(db.tx.threads[threadId].update({ title: editedTitle.trim() }));
      toast.success('Title updated');
    } catch (error) {
      toast.error('Failed to update title');
    }
    setIsEditingTitle(false);
  };

  // Handle title input key down
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const isExa = selectedModel === 'exa';
  const selectedModelObj = models.find(model => model.id === selectedModel);

  // Retry logic: fill input, focus
  const handleRetryMessage = useCallback((message: Message) => {
    if (message.role !== 'user') return;
    chat.setInput(message.content || '');
    setQuotedText(message.quotedText || '');
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 100);
  }, [chat]);

  // Combine hook messages with DB messages for display
  // Prefer hook messages when streaming, fall back to DB messages
  const displayMessages = chat.messages.length > 0 ? chat.messages : dbMessages;

  // Sort messages by createdAt ascending
  const sortedMessages = [...displayMessages].sort((a, b) => {
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

        {/* Desktop & Tablet Layout */}
        <div className="hidden md:block h-screen overflow-hidden">
          {isAuthenticated && (
            <LeftSidebar
              onNewChat={handleNewChat}
              isExpanded={isExpanded}
              setIsExpanded={setIsExpanded}
              isHydrating={!sidebarMounted}
            />
          )}

          <div className={cn(
            "h-screen flex flex-col transition-all duration-300",
            isAuthenticated ? (isExpanded ? "ml-64" : "ml-14") : "ml-0"
          )}>
            <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-full flex flex-col">
              <div className="relative flex-1 flex flex-col overflow-hidden">
                {/* Top fade gradient */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[var(--secondary-default)] to-transparent z-10 pointer-events-none" />

                <div className="flex-1 overflow-y-auto no-scrollbar">
                  {/* Loading skeleton */}
                </div>

                {/* Bottom fade gradient */}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--secondary-default)] via-[var(--secondary-default)]/80 to-transparent z-10 pointer-events-none" />

                <div className="absolute bottom-0 left-0 right-0 z-20">
                  <ChatInput
                    ref={chatInputRef}
                    input={chat.input}
                    handleInputChange={handleInputChange}
                    handleSubmit={(e) => handleSubmit(e, attachments)}
                    isLoading={true}
                    selectedModel={selectedModel}
                    handleModelChange={handleModelChange}
                    models={models}
                    isExa={isExa}
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
          </div>
        </div>

        {/* Mobile Content */}
        <div className="md:hidden h-screen flex flex-col overflow-hidden relative">
          {isAuthenticated && (
            <LeftSidebar
              onNewChat={handleNewChat}
              isExpanded={isExpanded}
              setIsExpanded={setIsExpanded}
              isHydrating={!sidebarMounted}
            />
          )}

          {isExpanded && isAuthenticated && (
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsExpanded(false)}
            />
          )}

          <div className="relative flex-1 flex flex-col overflow-hidden">
            {/* Top fade gradient */}
            <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-[var(--secondary-default)] to-transparent z-10 pointer-events-none" />

            <div className="flex-1 overflow-y-auto no-scrollbar">
              {/* Loading skeleton */}
            </div>

            {/* Bottom fade gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[var(--secondary-default)] via-[var(--secondary-default)]/80 to-transparent z-10 pointer-events-none" />

            <div className="absolute bottom-0 left-0 right-0 z-20">
              <ChatInput
                ref={chatInputRef}
                input={chat.input}
                handleInputChange={handleInputChange}
                handleSubmit={(e) => handleSubmit(e, attachments)}
                isLoading={true}
                selectedModel={selectedModel}
                handleModelChange={handleModelChange}
                models={models}
                isExa={isExa}
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
      </>
    );
  }

  // Format time ago
  const getTimeAgo = (date: Date | string | undefined) => {
    if (!date) return '';
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min. ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr. ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden">
        <Header onToggleSidebar={() => setIsExpanded(true)} />
      </div>

      {/* Desktop & Tablet Layout */}
      <div className="hidden md:block h-screen overflow-hidden bg-[#F0F0ED] dark:bg-[#0F1516]">
        {isAuthenticated && (
          <LeftSidebar
            onNewChat={handleNewChat}
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            isHydrating={!sidebarMounted}
          />
        )}

        <div className={cn(
          "h-screen flex flex-col transition-all duration-300",
          isAuthenticated ? (isExpanded ? "ml-64" : "ml-14") : "ml-0"
        )}>
          {/* Top Header Bar */}
          <div className="flex-shrink-0 h-12 bg-[#F0F0ED] dark:bg-[#0F1516] flex items-center justify-between px-4">
            <div className="flex items-center gap-3 text-sm text-[#64748B]">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-[#20B8CD] flex items-center justify-center">
                  <User className="w-3 h-3 text-white" />
                </div>
                <span className="font-medium text-[#13343B] dark:text-[#F8F8F7]">
                  {user?.email?.split('@')[0] || 'User'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{getTimeAgo(thread?.createdAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    onBlur={handleSaveTitle}
                    className="text-sm text-[#13343B] dark:text-[#F8F8F7] font-medium bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333] rounded px-2 py-1 outline-none focus:border-[#20B8CD] max-w-[300px]"
                  />
                </div>
              ) : (
                <button
                  onClick={handleStartEditTitle}
                  className="flex items-center gap-1.5 text-sm text-[#13343B] dark:text-[#F8F8F7] font-medium truncate max-w-[300px] hover:bg-[#E5E5E5] dark:hover:bg-[#2A2A2A] px-2 py-1 rounded transition-colors group"
                >
                  <span className="truncate">{thread?.title || 'New Chat'}</span>
                  <Pencil className="w-3 h-3 text-[#64748B] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <ShareButton threadId={threadId} />
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="relative flex-1 flex flex-col overflow-hidden">
              {/* Top fade gradient */}
              <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#F0F0ED] dark:from-[#0F1516] to-transparent z-10 pointer-events-none" />

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto no-scrollbar">
                <div className="pt-8 max-w-4xl mx-auto px-4">
                  <ChatMessages
                    messages={sortedMessages}
                    isLoading={chat.isLoading}
                    selectedModel={selectedModel}
                    selectedModelObj={selectedModelObj}
                    isExa={isExa}
                    currentThreadId={threadId}
                    threadTitle={thread?.title}
                    bottomPadding={chatInputHeightOffset + 24}
                    onQuote={setQuotedText}
                    onRetry={handleRetryMessage}
                  />
                </div>
              </div>

              {/* Bottom fade gradient */}
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#F0F0ED] dark:from-[#0F1516] via-[#F0F0ED]/80 dark:via-[#0F1516]/80 to-transparent z-10 pointer-events-none" />

              <div className="absolute bottom-0 left-0 right-0 z-20">
                <ChatInput
                  ref={chatInputRef}
                  input={chat.input}
                  handleInputChange={handleInputChange}
                  handleSubmit={(e) => handleSubmit(e, attachments)}
                  isLoading={chat.isLoading}
                  selectedModel={selectedModel}
                  handleModelChange={handleModelChange}
                  models={models}
                  isExa={isExa}
                  onNewChat={handleNewChat}
                  onAttachmentsChange={setAttachments}
                  activeChatFiles={activeChatFiles}
                  removeActiveFile={removeActiveFile}
                  onActiveFilesHeightChange={handleActiveFilesHeightChange}
                  quotedText={quotedText}
                  setQuotedText={setQuotedText}
                  onStop={chat.stop}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Content */}
      <div className="md:hidden h-screen flex flex-col overflow-hidden relative bg-[#F0F0ED] dark:bg-[#0F1516]">
        {isAuthenticated && (
          <LeftSidebar
            onNewChat={handleNewChat}
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            isHydrating={!sidebarMounted}
          />
        )}

        {isExpanded && isAuthenticated && (
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsExpanded(false)}
          />
        )}

        <div className="relative flex-1 flex flex-col overflow-hidden">
          {/* Top fade gradient */}
          <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-[#F0F0ED] dark:from-[#0F1516] to-transparent z-10 pointer-events-none" />

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <div className="pt-6 pb-24 px-4">
              <ChatMessages
                messages={sortedMessages}
                isLoading={chat.isLoading}
                selectedModel={selectedModel}
                selectedModelObj={selectedModelObj}
                isExa={isExa}
                currentThreadId={threadId}
                threadTitle={thread?.title}
                bottomPadding={chatInputHeightOffset}
                onQuote={setQuotedText}
                onRetry={handleRetryMessage}
              />
            </div>
          </div>

          {/* Bottom fade gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#F0F0ED] dark:from-[#0F1516] via-[#F0F0ED]/80 dark:via-[#0F1516]/80 to-transparent z-10 pointer-events-none" />

          <div className="absolute bottom-0 left-0 right-0 z-20">
            <ChatInput
              ref={chatInputRef}
              input={chat.input}
              handleInputChange={handleInputChange}
              handleSubmit={(e) => handleSubmit(e, attachments)}
              isLoading={chat.isLoading}
              selectedModel={selectedModel}
              handleModelChange={handleModelChange}
              models={models}
              isExa={isExa}
              onNewChat={handleNewChat}
              onAttachmentsChange={setAttachments}
              activeChatFiles={activeChatFiles}
              removeActiveFile={removeActiveFile}
              onActiveFilesHeightChange={handleActiveFilesHeightChange}
              quotedText={quotedText}
              setQuotedText={setQuotedText}
              onStop={chat.stop}
            />
          </div>
        </div>
      </div>

      {/* Auth Dialog */}
      <AuthDialog onSuccess={() => {}} />
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
  );
}
