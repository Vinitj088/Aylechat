'use client';

import { useState, useRef, useEffect, Suspense, useCallback, useMemo, memo } from 'react';
import { Message, Model, ModelType } from './types';
import Header from './component/Header';
import dynamic from 'next/dynamic';
import { ChatInputHandle } from './component/ChatInput';
import { useAyleChat } from './hooks/useAyleChat';
import { useSidebarContext } from '@/context/SidebarContext';
import modelsData from '../models.json';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { QueryEnhancerProvider } from '@/context/QueryEnhancerContext';

// Lazy load heavy components with no loading spinners for faster perceived performance
const ChatMessages = dynamic(() => import('./component/ChatMessages'), { ssr: false });
const DynamicChatInput = dynamic(() => import('./component/ChatInput'), { ssr: false });
const MobileSearchUI = dynamic(() => import('./component/MobileSearchUI'), { ssr: false });
const DesktopSearchUI = dynamic(() => import('./component/DesktopSearchUI'), { ssr: false });

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
  const { isExpanded, setIsExpanded, sidebarMounted } = useSidebarContext();

  // UI State
  const [selectedModel, setSelectedModel] = useState<ModelType>('openai/gpt-oss-20b');
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
      // Use router.replace to navigate to the chat page without adding to history
      // This ensures the page component actually changes
      router.replace(`/chat/${threadId}`);
    },
  });

  // Memoize models to prevent recalculation
  const allModels = useMemo(() => {
    const providerOrder = ['perplexity', 'google', 'cerebras', 'inception', 'groq', 'openrouter', 'together'];
    return [
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
    ] as Model[];
  }, []);

  // Initialize models
  useEffect(() => {
    setModels(allModels);
    const modelParam = searchParams?.get('model');
    if (modelParam) {
      setSelectedModel(modelParam as ModelType);
    }
  }, [searchParams, allModels]);

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
    // Reset chat state and navigate to home
    chat.reset();
    router.push('/');
  }, [chat, router]);

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

  // Memoize guest models and sorted messages
  const guestModels = useMemo(() =>
    models.filter(model => model.id === 'openai/gpt-oss-20b' || model.id === 'gemini-2.5-flash' || model.providerId === 'cerebras'),
    [models]
  );

  const sortedMessages = useMemo(() =>
    [...chat.messages].sort((a, b) => {
      const aDate = typeof a.createdAt === 'string' ? a.createdAt : a.createdAt?.toISOString?.() || '';
      const bDate = typeof b.createdAt === 'string' ? b.createdAt : b.createdAt?.toISOString?.() || '';
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    }),
    [chat.messages]
  );

  // Memoize which models to show
  const displayModels = isGuest ? guestModels : models;

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden">
        <Header onToggleSidebar={() => setIsExpanded(true)} />
      </div>

      {/* Desktop & Tablet Layout */}
      <div className="hidden md:flex md:flex-col h-screen">
        {!hasMessages ? (
          <DesktopSearchUI
            input={chat.input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            isLoading={chat.isLoading}
            selectedModel={selectedModel}
            handleModelChange={handleModelChange}
            models={displayModels}
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
          <div className="relative flex-1 flex flex-col overflow-hidden bg-[#F0F0ED] dark:bg-[#191a1a] contain-layout">
            {/* Top fade gradient */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#F0F0ED] dark:from-[#191a1a] to-transparent z-10 pointer-events-none" />

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto no-scrollbar overscroll-contain">
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
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#F0F0ED] dark:from-[#191a1a] via-[#F0F0ED]/80 dark:via-[#191a1a]/80 to-transparent z-10 pointer-events-none" />

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
                  models={displayModels}
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
              <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center justify-center py-8 px-4 text-center bg-[#F0F0ED] dark:bg-[#191a1a]">
                <p className="text-base font-medium mb-2 text-[#64748B]">
                  Sign in to unlock unlimited messages
                </p>
                <button
                  className="px-4 py-2 text-sm font-medium text-white bg-[#13343B] active:bg-[#0d2529] rounded-lg touch-manipulation"
                  onClick={openAuthDialog}
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Content */}
      <div className="md:hidden flex flex-col h-[100dvh] relative">
        {!hasMessages ? (
          <MobileSearchUI
            input={chat.input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            isLoading={chat.isLoading}
            selectedModel={selectedModel}
            handleModelChange={handleModelChange}
            models={displayModels}
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
          <div className="relative flex-1 flex flex-col overflow-hidden bg-[#F0F0ED] dark:bg-[#191a1a] contain-layout">
            {/* Top fade gradient */}
            <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-[#F0F0ED] dark:from-[#191a1a] to-transparent z-10 pointer-events-none" />

            {/* Messages area - optimized for mobile scrolling */}
            <div className="flex-1 overflow-y-auto no-scrollbar overscroll-contain -webkit-overflow-scrolling-touch">
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
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#F0F0ED] dark:from-[#191a1a] via-[#F0F0ED]/80 dark:via-[#191a1a]/80 to-transparent z-10 pointer-events-none" />

            <div className="absolute bottom-0 left-0 right-0 z-20 safe-area-bottom">
              <DynamicChatInput
                ref={chatInputRef}
                input={chat.input}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                isLoading={chat.isLoading}
                selectedModel={selectedModel}
                handleModelChange={handleModelChange}
                models={displayModels}
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
              <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center justify-center py-6 px-4 text-center bg-[#F0F0ED] dark:bg-[#191a1a] safe-area-bottom">
                <p className="text-base font-medium mb-2 text-[#64748B]">
                  Sign in to unlock unlimited messages
                </p>
                <button
                  className="px-4 py-2 text-sm font-medium text-white bg-[#13343B] active:bg-[#0d2529] rounded-lg touch-manipulation"
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
