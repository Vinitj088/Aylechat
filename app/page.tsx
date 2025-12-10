'use client';

import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Message, Model, ModelType } from './types';
import Header from './component/Header';
import dynamic from 'next/dynamic';
import { ChatInputHandle } from './component/ChatInput';
import MobileSearchUI from './component/MobileSearchUI';
import DesktopSearchUI from './component/DesktopSearchUI';
import LeftSidebar from './component/LeftSidebar';
import { useAyleChat } from './hooks/useAyleChat';
import modelsData from '../models.json';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { QueryEnhancerProvider } from '@/context/QueryEnhancerContext';
import { cn } from '@/lib/utils';

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

// Helper function to get provider description
const getProviderDescription = (providerName: string | undefined): string => {
  const descriptions: Record<string, string> = {
    'google': 'Google provides higher context limits up to 1M tokens.',
    'openrouter': 'OpenRouter provides access to the latest AI models.',
    'cerebras': 'Cerebras offers exceptionally fast AI inference.',
    'groq': 'Groq delivers lightning-fast inference using LPUs.',
    'together ai': 'Together AI provides cutting-edge image generation capabilities.',
    'perplexity': 'Perplexity provides real-time search and web-aware AI responses.',
  };
  return descriptions[providerName?.toLowerCase() || ''] || `${providerName || 'This provider'} offers fast AI inference.`;
};

// Constants
const GUEST_MESSAGE_LIMIT = 3;
const GUEST_MESSAGE_KEY = 'guestMessageCount';

function PageContent() {
  // Auth and routing
  const { user, isLoading: authLoading, openAuthDialog } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // UI State
  const [isExpanded, setIsExpanded] = useState(false);
  const [sidebarMounted, setSidebarMounted] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-2.0-flash');
  const [models, setModels] = useState<Model[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [quotedText, setQuotedText] = useState('');
  const [activeChatFiles, setActiveChatFiles] = useState<Array<{ name: string; type: string; uri: string }>>([]);
  const [chatInputHeightOffset, setChatInputHeightOffset] = useState(0);

  // Guest tracking
  const [guestMessageCount, setGuestMessageCount] = useState(0);
  const [guestCountLoaded, setGuestCountLoaded] = useState(false);
  const prevGuestMessageCount = useRef(guestMessageCount);

  // Refs
  const chatInputRef = useRef<ChatInputHandle>(null);

  const isAuthenticated = !!user;
  const isGuest = !user;

  // Use AI SDK chat hook
  const chat = useAyleChat({
    threadId: null, // New thread
    userId: user?.id || null,
    selectedModel,
    initialMessages: [],
    onThreadCreated: (threadId) => {
      window.history.pushState({}, '', `/chat/${threadId}`);
    },
  });

  // Initialize models
  useEffect(() => {
    const providerOrder = ['perplexity', 'google', 'cerebras', 'inception', 'groq', 'openrouter', 'together'];
    const allModels: Model[] = [
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

    // Check URL for model param
    const modelParam = searchParams?.get('model');
    if (modelParam) {
      setSelectedModel(modelParam as ModelType);
    }
  }, [searchParams]);

  // Handle URL search queries (browser search engine integration)
  useEffect(() => {
    if (chat.messages.length === 0 && !chat.isLoading) {
      const searchQuery = searchParams?.get('q');
      if (searchQuery && searchQuery !== '$1' && searchQuery !== '%s') {
        const decodedQuery = decodeURIComponent(searchQuery);
        chat.setInput(decodedQuery);
        setSelectedModel('exa');

        // Auto-submit after delay
        const timer = setTimeout(() => {
          if (decodedQuery.trim() && !isGuest) {
            chat.submit(decodedQuery);
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [searchParams, chat.messages.length, chat.isLoading, isGuest]);

  // Load sidebar state
  useEffect(() => {
    const saved = localStorage.getItem('sidebarExpanded');
    if (saved) setIsExpanded(JSON.parse(saved));
    setSidebarMounted(true);
  }, []);

  // Persist sidebar state
  useEffect(() => {
    if (sidebarMounted) {
      localStorage.setItem('sidebarExpanded', JSON.stringify(isExpanded));
    }
  }, [isExpanded, sidebarMounted]);

  // Set document title
  useEffect(() => {
    document.title = 'Ayle';
  }, []);

  // Guest message tracking
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(GUEST_MESSAGE_KEY);
      setGuestMessageCount(stored ? parseInt(stored, 10) : 0);
      setGuestCountLoaded(true);
    }
  }, []);

  // Clear guest counter on sign-in
  useEffect(() => {
    if (user && typeof window !== 'undefined') {
      localStorage.removeItem(GUEST_MESSAGE_KEY);
    }
  }, [user]);

  // Toast for remaining guest messages
  useEffect(() => {
    if (
      isGuest &&
      guestCountLoaded &&
      guestMessageCount > 0 &&
      guestMessageCount < GUEST_MESSAGE_LIMIT &&
      guestMessageCount > prevGuestMessageCount.current
    ) {
      const remaining = GUEST_MESSAGE_LIMIT - guestMessageCount;
      toast.info(`${remaining} message${remaining === 1 ? '' : 's'} remaining`);
    }
    prevGuestMessageCount.current = guestMessageCount;
  }, [guestMessageCount, isGuest, guestCountLoaded]);

  // Keyboard shortcut for focusing input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement).isContentEditable
      ) return;

      if (e.key === '/' && !chat.isLoading) {
        e.preventDefault();
        chatInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chat.isLoading]);

  // Handlers
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement> | string) => {
    const value = typeof e === 'string' ? e : e.target.value;
    chat.setInput(value);
  }, [chat]);

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId as ModelType);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chat.input.trim() && attachments.length === 0) return;

    // Guest limit check
    if (isGuest) {
      if (guestMessageCount >= GUEST_MESSAGE_LIMIT) {
        openAuthDialog();
        return;
      }
      // Increment guest counter
      setGuestMessageCount(count => {
        const newCount = count + 1;
        if (typeof window !== 'undefined') {
          localStorage.setItem(GUEST_MESSAGE_KEY, newCount.toString());
        }
        return newCount;
      });
    }

    // Auth check for non-guests
    if (!isGuest && !isAuthenticated) {
      openAuthDialog();
      return;
    }

    await chat.submit(chat.input.trim(), {
      attachments: attachments.length > 0 ? attachments : undefined,
      quotedText: quotedText || undefined,
    });

    setQuotedText('');
    setAttachments([]);
  }, [chat, attachments, quotedText, isGuest, isAuthenticated, guestMessageCount, openAuthDialog]);

  const handleNewChat = useCallback(() => {
    window.scrollTo(0, 0);
    window.history.pushState({}, '', '/');
    window.location.reload(); // Clean state
  }, []);

  const handleActiveFilesHeightChange = useCallback((height: number) => {
    setChatInputHeightOffset(height > 0 ? height + 8 : 0);
  }, []);

  const removeActiveFile = useCallback((uri: string) => {
    setActiveChatFiles(prev => prev.filter(f => f.uri !== uri));
  }, []);

  const handleRetryMessage = useCallback((message: Message) => {
    if (message.role !== 'user') return;
    chat.setInput(message.content || '');
    setQuotedText(message.quotedText || '');
    setTimeout(() => chatInputRef.current?.focus(), 100);
  }, [chat]);

  // Derived state
  const isExa = selectedModel === 'exa';
  const selectedModelObj = models.find(model => model.id === selectedModel);
  const hasMessages = chat.messages.length > 0;
  const providerName = selectedModelObj?.provider || 'AI';
  const description = isExa
    ? 'Exa search uses embeddings to understand meaning.'
    : getProviderDescription(providerName);

  // Guest model filtering
  const guestModels = models.filter(
    model => model.id === 'gemini-2.0-flash' || model.id === 'gemini-2.5-flash' || model.providerId === 'cerebras'
  );

  // Sort messages
  const sortedMessages = [...chat.messages].sort((a, b) => {
    const aDate = typeof a.createdAt === 'string' ? a.createdAt : a.createdAt?.toISOString?.() || '';
    const bDate = typeof b.createdAt === 'string' ? b.createdAt : b.createdAt?.toISOString?.() || '';
    return new Date(aDate).getTime() - new Date(bDate).getTime();
  });

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden">
        <Header onToggleSidebar={() => setIsExpanded(true)} />
      </div>

      {/* Desktop & Tablet Layout */}
      <div className="hidden md:block min-h-screen">
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
            {!hasMessages ? (
              <DesktopSearchUI
                input={chat.input}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                isLoading={chat.isLoading}
                selectedModel={selectedModel}
                handleModelChange={handleModelChange}
                models={isGuest ? guestModels : models}
                setInput={chat.setInput}
                description={description}
                messages={chat.messages}
                onAttachmentsChange={setAttachments}
                isGuest={isGuest}
                guestMessageCount={guestMessageCount}
                guestMessageLimit={GUEST_MESSAGE_LIMIT}
                openAuthDialog={openAuthDialog}
              />
            ) : (
              <div className="relative flex-1 flex flex-col overflow-hidden">
                {/* Top fade gradient */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[var(--secondary-default)] to-transparent z-10 pointer-events-none" />

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  <div className="pt-8">
                    <ChatMessages
                      messages={sortedMessages}
                      isLoading={chat.isLoading}
                      selectedModel={selectedModel}
                      selectedModelObj={selectedModelObj}
                      isExa={isExa}
                      currentThreadId={chat.threadId}
                      bottomPadding={chatInputHeightOffset + 24}
                      onQuote={setQuotedText}
                      onRetry={handleRetryMessage}
                    />
                  </div>
                </div>

                {/* Bottom fade gradient */}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--secondary-default)] via-[var(--secondary-default)]/80 to-transparent z-10 pointer-events-none" />

                {(!isGuest || guestMessageCount < GUEST_MESSAGE_LIMIT) ? (
                  <div className="absolute bottom-0 left-0 right-0 z-20">
                    <DynamicChatInput
                      ref={chatInputRef}
                      input={chat.input}
                      handleInputChange={handleInputChange}
                      handleSubmit={handleSubmit}
                      isLoading={chat.isLoading}
                      selectedModel={selectedModel}
                      handleModelChange={handleModelChange}
                      models={isGuest ? guestModels : models}
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
                ) : (
                  <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center justify-center py-8 px-4 text-center bg-[var(--secondary-default)]">
                    <p className="text-lg font-semibold mb-2 text-gray-300">
                      Sign in to unlock unlimited messages and advanced features
                    </p>
                    <button
                      className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand-dark)] hover:bg-[var(--brand-default)] rounded-lg transition-colors"
                      onClick={openAuthDialog}
                    >
                      Sign In
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Content */}
      <div className="md:hidden h-screen flex flex-col relative">
        <LeftSidebar
          onNewChat={handleNewChat}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          isHydrating={!sidebarMounted}
        />

        {isExpanded && (
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsExpanded(false)}
          />
        )}

        {!hasMessages ? (
          <MobileSearchUI
            input={chat.input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            isLoading={chat.isLoading}
            selectedModel={selectedModel}
            handleModelChange={handleModelChange}
            models={isGuest ? guestModels : models}
            setInput={chat.setInput}
            messages={chat.messages}
            description={description}
            onAttachmentsChange={setAttachments}
            isGuest={isGuest}
            guestMessageCount={guestMessageCount}
            guestMessageLimit={GUEST_MESSAGE_LIMIT}
            openAuthDialog={openAuthDialog}
          />
        ) : (
          <div className="relative flex-1 flex flex-col overflow-hidden">
            {/* Top fade gradient */}
            <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-[var(--secondary-default)] to-transparent z-10 pointer-events-none" />

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <div className="pt-6 pb-24">
                <ChatMessages
                  messages={sortedMessages}
                  isLoading={chat.isLoading}
                  selectedModel={selectedModel}
                  selectedModelObj={selectedModelObj}
                  isExa={isExa}
                  currentThreadId={chat.threadId}
                />
              </div>
            </div>

            {/* Bottom fade gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[var(--secondary-default)] via-[var(--secondary-default)]/80 to-transparent z-10 pointer-events-none" />

            <div className="absolute bottom-0 left-0 right-0 z-20">
              <DynamicChatInput
                ref={chatInputRef}
                input={chat.input}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                isLoading={chat.isLoading}
                selectedModel={selectedModel}
                handleModelChange={handleModelChange}
                models={isGuest ? guestModels : models}
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

            {isGuest && guestMessageCount >= GUEST_MESSAGE_LIMIT && (
              <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center justify-center py-8 px-4 text-center bg-[var(--secondary-default)]">
                <p className="text-lg font-semibold mb-2 text-gray-300">
                  Sign in to unlock unlimited messages and advanced features
                </p>
                <button
                  className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand-dark)] hover:bg-[var(--brand-default)] rounded-lg transition-colors"
                  onClick={openAuthDialog}
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <QueryEnhancerProvider>
        <PageContent />
      </QueryEnhancerProvider>
    </Suspense>
  );
}
