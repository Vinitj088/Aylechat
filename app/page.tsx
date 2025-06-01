'use client';

import { useState, useRef, useEffect, Suspense, useCallback, useMemo } from 'react';
import { Message, Model, ModelType, FileAttachment } from './types';
import { useChat, CreateMessage } from '@ai-sdk/react';
import Header from './component/Header';
import dynamic from 'next/dynamic';
import { ChatInputHandle } from './component/ChatInput';
import MobileSearchUI from './component/MobileSearchUI';
import DesktopSearchUI from './component/DesktopSearchUI';
import Sidebar from './component/Sidebar';
import { fetchResponse } from './api/apiService';
import modelsData from '../models.json';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AuthDialog } from '@/components/AuthDialog';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { prefetchAll } from './api/prefetch';
import { FileUp, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

// Helper function to get provider description
const getProviderDescription = (providerName: string | undefined): string => {
  switch (providerName?.toLowerCase()) {
    case 'google':
      return 'Google provides higher context limits up to 1M tokens.';
    case 'openrouter':
      return 'OpenRouter provides access to the latest AI models.';
    case 'cerebras':
      return 'Cerebras offers exceptionally fast AI inference.';
    case 'groq':
      return 'Groq delivers lightning-fast inference using LPUs.';
    case 'together ai':
      return 'Together AI provides cutting-edge image generation capabilities.';
    // Add more cases as needed
    default:
      return `${providerName || 'This provider'} offers fast AI inference.`; // Default message
  }
};

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

const DynamicSidebar = dynamic(() => import('./component/Sidebar'), {
  ssr: false
});

// Create a new component that uses useSearchParams
function PageContent() {
  const [localMessages, setLocalMessages] = useState<Message[]>([]); // For non-useChat messages (images, initial search)
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
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [refreshSidebar, setRefreshSidebar] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, session, isLoading: authLoading, openAuthDialog } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatInputRef = useRef<ChatInputHandle>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const scrapeAbortControllerRef = useRef<AbortController | null>(null);
  const [activeChatFiles, setActiveChatFiles] = useState<Array<{ name: string; type: string; uri: string }>>([]);
  const [chatInputHeightOffset, setChatInputHeightOffset] = useState(0);

  const isCreatingThreadRef = useRef(false);
  const pendingMessagesRef = useRef<CreateMessage[]>([]);

  const isAuthenticated = !!user;

  const {
    messages: chatMessages, // These are the messages managed by useChat
    input,
    setInput,
    handleInputChange,
    handleSubmit: originalUseChatHandleSubmit, // Renamed
    append, // Ensure append is destructured
    isLoading: chatIsLoading, // isLoading from useChat
    error: chatError,
    stop: stopChat,
    reload: reloadChat,
    setMessages: setChatMessages, // setMessages from useChat
    data: chatData
  } = useChat({
    api: '/api/ai',
    onFinish: async (message) => { // message is assistant's final message.
      const localCurrentThreadId = currentThreadId;

      // chatMessages from useChat hook is already updated with the latest user and assistant messages
      const currentMessagesFromHook = chatMessages;

      let titleToUse: string | null = null;
      // Check if this is the first successful exchange in a new chat
      if (!localCurrentThreadId && currentMessagesFromHook.length >= 2 && currentMessagesFromHook[currentMessagesFromHook.length - 2].role === 'user') {
          const lastUserMessageContent = currentMessagesFromHook[currentMessagesFromHook.length - 2].content;
          titleToUse = lastUserMessageContent.substring(0, 50) + (lastUserMessageContent.length > 50 ? '...' : '');
      }

      const newThreadId = await createOrUpdateThread(
        {
          messages: currentMessagesFromHook,
          title: titleToUse,
        },
        localCurrentThreadId,
        selectedModel
      );

      if (newThreadId) {
        if (!localCurrentThreadId) { // This onFinish call was responsible for CREATING the thread
          setCurrentThreadId(newThreadId);
          window.history.pushState({}, '', `/chat/${newThreadId}`);
          setRefreshSidebar(prev => prev + 1);

          isCreatingThreadRef.current = false;
          const messagesToProcess = [...pendingMessagesRef.current];
          pendingMessagesRef.current = [];

          if (messagesToProcess.length > 0) {
            toast.info(`Processing ${messagesToProcess.length} queued message(s)...`);
            for (const pendingMsg of messagesToProcess) {
              append(pendingMsg, { // append is from useChat
                body: {
                  selectedModel: selectedModel,
                  activeChatFiles: activeChatFiles,
                }
              });
            }
          }
        } else if (localCurrentThreadId && newThreadId === localCurrentThreadId) {
            // This was an update to an existing thread
            setRefreshSidebar(prev => prev + 1);
            // Defensive reset if isCreatingThreadRef was somehow still true
            if (isCreatingThreadRef.current) {
                isCreatingThreadRef.current = false;
            }
        }
        // Case where newThreadId is different from a non-null localCurrentThreadId is not explicitly handled,
        // but implies something unexpected happened server-side.
      } else { // newThreadId is null, meaning createOrUpdateThread failed
        if (!localCurrentThreadId && isCreatingThreadRef.current) {
          // Creation attempt failed
          isCreatingThreadRef.current = false;
          toast.error('Failed to create conversation. Queued messages cleared.');
          pendingMessagesRef.current = [];
        }
        // If update failed (localCurrentThreadId was not null), just toast or log, no queue to manage.
        else if (localCurrentThreadId) {
           toast.error('Failed to save conversation update.');
        }
      }
    },
    onError: (err) => {
      toast.error(err.message || 'An error occurred with the AI chat connection.');
      // Check if this error is related to the initial message that was trying to create a thread
      if (isCreatingThreadRef.current && currentThreadId === null) {
          isCreatingThreadRef.current = false;
          toast.error('Queued messages cleared due to error during conversation creation.');
          pendingMessagesRef.current = [];
      }
    }
  });

  // Combine messages from useChat with local messages for display
  const messages = useMemo(() => {
    // Simple merge: prioritize useChat messages if IDs overlap, or just combine if distinct.
    // This might need more sophisticated merging if IDs can collide or order is critical.
    // For now, assume localMessages are for things useChat doesn't handle (e.g. initial search, images)
    // and chatMessages are for the main interactive chat.
    // If useChat is handling the main flow, perhaps localMessages should only be for specific other cases.
    // When transitioning, decide which message list is authoritative or how to merge.
    // For now, let's assume that if chatMessages has items, it's the primary one.
    return chatMessages.length > 0 ? chatMessages : localMessages;
  }, [chatMessages, localMessages]);

  // Need a way to update messages for non-useChat flows (initial search, image gen)
  // This setMessages will now refer to setLocalMessages for those specific flows.
  const setMessages = setLocalMessages;


  // Prefetch API modules and data when the app loads
  useEffect(() => {
    // Prefetch all API modules and data for faster initial response times
    prefetchAll().catch(() => {
      // Silently ignore prefetch errors as this is just an optimization
    });
  }, []);

  // Check URL parameters for auth dialog control
  useEffect(() => {
    // Add null check for searchParams before accessing it
    if (!searchParams) return;

    const authRequired = searchParams.get('authRequired');
    const expired = searchParams.get('expired');
    const error = searchParams.get('error');
    const sessionError = searchParams.get('session_error');
    const cookieError = searchParams.get('cookie_error');
    
    // Show auth dialog if any of these params are present
    if (authRequired === 'true' || expired === 'true' || error || sessionError || cookieError) {
      if (authRequired === 'true' || expired === 'true' || error) {
          openAuthDialog();
      }
      
      // Show toast message if session expired
      if (expired === 'true') {
        toast.error('Your session has expired. Please sign in again.');
      }
      // Show toast message if there was an error
      if (error) {
        toast.error('Authentication error. Please sign in again.');
      }
      
      // Handle session/cookie errors with toast + sign in action
      if (sessionError === 'true' || cookieError === 'true') {
          toast.error('Session issue detected', {
            description: 'Please sign in again to get a fresh session',
            duration: 6000,
            action: {
              label: 'Sign In',
              onClick: () => {
                openAuthDialog();
              }
            }
          });
      }
      
      // Clean URL by removing query parameters without reloading the page
      const url = new URL(window.location.href);
      url.searchParams.delete('authRequired');
      url.searchParams.delete('expired');
      url.searchParams.delete('error');
      url.searchParams.delete('session_error');
      url.searchParams.delete('cookie_error');
      window.history.replaceState({}, '', url);
    }
  }, [searchParams, openAuthDialog]);

  // Check for authRequired query param (redundant with above, can be simplified later if needed)
  useEffect(() => {
    if (searchParams && searchParams.get('authRequired') === 'true') {
      openAuthDialog();
    }
  }, [searchParams, openAuthDialog]);

  // Load models and set initially selected model
  useEffect(() => {
    // Load models from models.json and set initial model
    const groqModels = modelsData.models.filter(model => model.providerId === 'groq');
    const googleModels = modelsData.models.filter(model => model.providerId === 'google');
    const openRouterModels = modelsData.models.filter(model => model.providerId === 'openrouter');
    const cerebrasModels = modelsData.models.filter(model => model.providerId === 'cerebras');
    const xaiModels = modelsData.models.filter(model => model.providerId === 'xai');
    const togetherModels = modelsData.models.filter(model => model.providerId === 'together');
    // Start with just the Exa model and then add the others
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
      ...xaiModels,
      ...googleModels,
      ...cerebrasModels,
      ...openRouterModels,
      ...groqModels,
      ...togetherModels,
    ]);
    
    // Get search params
    const searchParams = new URLSearchParams(window.location.search);
    const modelParam = searchParams.get('model');
    
    if (modelParam) {
      setSelectedModel(modelParam);
    }
  }, []);

  // Handle showing the auth dialog if opened via URL param
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('signIn') === 'true' || urlParams.get('auth') === 'true') {
      openAuthDialog();
    }
  }, [openAuthDialog]);
  
  // Handle initial URL search parameters for search engine functionality
  useEffect(() => {
    // Only run this once when the component mounts and there are no messages yet
    // Use `messages.length` (which refers to combined or localMessages) and chatIsLoading
    if (messages.length === 0 && !chatIsLoading) {
      const urlParams = new URLSearchParams(window.location.search);
      
      // Check for different query parameter formats (q, q=$1, q=%s)
      let searchQuery = urlParams.get('q');
      
      // Handle placeholder formats: ?q=$1 or ?q=%s
      if (searchQuery && (searchQuery === '$1' || searchQuery === '%s')) {
        searchQuery = '';
      }
      
      if (searchQuery !== null) {
        // Set the input field with the search query
        const decodedQuery = decodeURIComponent(searchQuery);
        setInput(decodedQuery);
        
        // Auto-select Exa Search model for search queries
        setSelectedModel('exa');
        
        // Submit the query automatically after a short delay to ensure everything is loaded
        const timer = setTimeout(async () => {
          if (decodedQuery.trim()) {
            // Instead of calling handleSubmit, replicate its logic here to avoid closure issues
            // This section still uses the old fetchResponse for initial Exa search.
            const userMessageLocal: Message = { // Renamed to avoid conflict if Message type from useChat is different
              id: crypto.randomUUID(),
              role: 'user',
              content: decodedQuery
            };

            const assistantMessageLocal: Message = {
              id: `ai-${Date.now()}`,
              role: 'assistant',
              content: '...',
              provider: selectedModelObj?.provider,
            };

            // setIsLoading(true); // chatIsLoading will be handled by useChat if this flow is migrated
            setLocalMessages([userMessageLocal, assistantMessageLocal]); // Use setLocalMessages

            try {
              const controller = new AbortController();
              abortControllerRef.current = controller; // This ref is still used by fetchResponse
              
              // Call fetchResponse and capture the complete message object
              const completedAssistantMessage = await fetchResponse(
                decodedQuery,
                [], // Empty history for initial search
                'exa', // Always use Exa for search queries
                controller,
                setLocalMessages, // Pass setLocalMessages for live updates
                assistantMessageLocal, // Pass the placeholder
                attachments, // attachments from PageContent state
                activeChatFiles, // activeChatFiles from PageContent state
                handleFileUploaded // handleFileUploaded from PageContent
              );

              // Update messages with final response using the returned object
              const finalMessages = [userMessageLocal, completedAssistantMessage];
              
              setLocalMessages(finalMessages);
              
              // Don't create a thread for URL search queries
              // This keeps browser search queries from being saved
              
              // setIsLoading(false);
              abortControllerRef.current = null;
            } catch (error: any) {
              console.error('Error performing search:', error);
              // setIsLoading(false);
              
              // Handle error display
              const updatedMessages = [userMessageLocal, {
                ...assistantMessageLocal,
                content: `Error: ${error.message || 'Failed to perform search. Please try again.'}`,
                completed: true
              }];
              
              setLocalMessages(updatedMessages);
              abortControllerRef.current = null;
            }
          }
        }, 800); // Increased delay for better reliability
        
        return () => clearTimeout(timer);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]); // Added authLoading to dependencies, ensure it runs after auth state is clear. Original had []

  // Step 5: Callback to handle file uploaded event from backend
  const handleFileUploaded = useCallback((fileInfo: { name: string; type: string; uri: string }) => {
    console.log('Adding uploaded file to active session:', fileInfo);
    setActiveChatFiles(prev => {
      // Avoid adding duplicates based on URI
      if (!prev.some(f => f.uri === fileInfo.uri)) {
        return [...prev, fileInfo];
      }
      return prev;
    });
  }, []);

  // Step 5: Function to remove an active file reference
  const removeActiveFile = useCallback((uri: string) => {
    setActiveChatFiles(prev => prev.filter(f => f.uri !== uri));
  }, []);

  // The form submit handler 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentInputContent = input.trim();
    if (!currentInputContent && attachments.length === 0) return;

    if (!isAuthenticated || !user) {
      openAuthDialog();
      return;
    }

    const messageToSubmit: CreateMessage = {
      role: 'user',
      content: currentInputContent,
    };

    const fileList = (() => {
      if (attachments.length === 0) return undefined;
      const dt = new DataTransfer();
      attachments.forEach(file => dt.items.add(file));
      return dt.files;
    })();

    if (currentThreadId === null) { // Potentially the first message for a new thread
      if (isCreatingThreadRef.current) {
        pendingMessagesRef.current.push(messageToSubmit);
        toast.info(`Message queued as conversation is being created... (${pendingMessagesRef.current.length})`);
        setInput('');
        setAttachments([]);
        return;
      } else {
        // This is the first message, and no creation is in progress
        isCreatingThreadRef.current = true;
      }
    }

    originalUseChatHandleSubmit(e, {
      body: {
        selectedModel: selectedModel,
        activeChatFiles: activeChatFiles,
      },
      experimental_attachments: fileList,
    });

    // Clear attachments if the message was submitted directly (not queued).
    setAttachments([]);
  };
  
  // Function to handle login button click
  const handleLoginClick = useCallback(() => {
    openAuthDialog();
  }, [openAuthDialog]);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId as ModelType);
    // If using useChat and model changes, might need to inform the hook if it affects API calls.
    // For now, selectedModel is passed in `append` options.
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Handle successful auth
  // This function is called from AuthDialog upon successful authentication.
  // We might want to trigger a reload of messages or resubmit a pending message if that was the interruption.
  const handleAuthSuccess = async () => {
    // Refresh sidebar to show latest threads
    setRefreshSidebar(prev => prev + 1);
    
    // Process pending input if any
    if (input.trim()) {
      setTimeout(() => {
        const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
        handleSubmit(fakeEvent);
      }, 300);
    }
  };

  // Triggered when authentication state changes - load threads
  useEffect(() => {
    if (isAuthenticated) {
      // Only trigger sidebar refresh on auth state change
      setRefreshSidebar(prev => prev + 1);
    }
  }, [isAuthenticated]);

  // Error handler callback function
  const handleRequestError = async (error: Error) => {
    // This function is now less critical if useChat.onError handles UI feedback.
    // However, it can still be used for specific error handling like opening auth dialog.
    if (error.message.includes('authentication') || error.message.includes('Authentication') ||
        error.message.includes('auth') || error.message.includes('Auth') ||
        error.message.includes('401') || error.message.includes('Unauthorized')) {
      openAuthDialog();
    } else if (error.message.includes('Rate limit')) {
      // @ts-ignore
      const waitTime = error.waitTime || 30;
      toast.error('RATE LIMIT', { description: `Please wait ${waitTime} seconds before trying again`, duration: 5000 });
    } else {
      toast.error('Error Processing Request', { description: error.message || 'Please try again later', duration: 5000 });
    }
  };

  // Modified createOrUpdateThread to accept currentThreadId and selectedModel as params
  const createOrUpdateThread = async (
    threadContent: { messages: Message[] | CreateMessage[], title?: string | null }, // messages can be from useChat or local
    threadIdFromParam: string | null, // Explicitly pass currentThreadId
    modelForThread: string // Explicitly pass selectedModel
  ) => {
    if (!isAuthenticated || !user) {
      openAuthDialog();
      return null;
    }

    try {
      const method = threadIdFromParam ? 'PUT' : 'POST';
      const endpoint = threadIdFromParam
        ? `/api/chat/threads/${threadIdFromParam}`
        : '/api/chat/threads';
      
      const timestamp = Date.now();
      
      // Ensure messages are in the format expected by the backend (likely plain Message[])
      const plainMessages = threadContent.messages.map(m => ({
        id: m.id || `temp-${crypto.randomUUID()}`, // Ensure ID exists
        role: m.role,
        content: m.content,
        ...(m as any).attachments ? { attachments: (m as any).attachments } : {}
      }));

      const response = await fetch(`${endpoint}?t=${timestamp}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        credentials: 'include',
        body: JSON.stringify({
          messages: plainMessages, // Send plain messages
          title: threadContent.title,
          model: modelForThread // Use passed selectedModel
        })
      });

      if (!response.ok) {
        if (response.status === 0 && response.type === 'opaque') {
           console.warn('Opaque response from createOrUpdateThread, possibly CORS or network issue during redirect.');
           // For opaque responses, we can't read the body, so we might assume success or handle as error.
           // This might happen if the server redirects after PUT/POST and it's a cross-origin redirect.
           // For now, let's not throw an error here but log it.
           return threadIdFromParam; // Assume it worked if updating existing.
        }
        if (response.status === 401) {
          openAuthDialog();
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Only parse JSON if response is not opaque and has content
      if (response.headers.get("content-length") && parseInt(response.headers.get("content-length")!) > 0) {
        const result = await response.json();
        if (result.success && result.thread) {
          // setCurrentThreadId is handled by onFinish now
          // Refresh sidebar is also handled by onFinish
          return result.thread.id;
        }
      } else if (method === 'PUT' && response.ok) {
        // If PUT was successful but no content (e.g. 204 No Content), return the original thread ID
        return threadIdFromParam;
      }
      
      return null;
    } catch (error: any) {
      console.error('Error saving thread:', error);
      if (error.message?.toLowerCase().includes('unauthorized') || error.message?.includes('JSON')) {
        handleRequestError(error);
      } else {
        toast.error('Error saving conversation');
      }
      return null;
    }
  };

  // Derived variables
  const isExa = selectedModel === 'exa';
  const selectedModelObj = models.find(model => model.id === selectedModel);
  // Use `messages.length` (which is memoized from chatMessages or localMessages)
  const hasMessages = messages.length > 0;

  // Get the provider name for the selected model
  const providerName = selectedModelObj?.provider || 'AI';

  // Calculate the description based on model
  const description = isExa 
    ? 'Exa search uses embeddings to understand meaning.' 
    : getProviderDescription(providerName);

  const handleNewChat = () => {
    window.scrollTo(0, 0);
    setMessages([]);
    setInput('');
    setCurrentThreadId(null);
    setActiveChatFiles([]);
    window.history.pushState({}, '', '/');
  };

  const handleStartChat = () => {
    if (user) {
      router.push('/chat/new');
    } else {
      openAuthDialog();
    }
  };

  const handleCreateThread = async () => {
    try {
      router.push('/chat/new');
    } catch (error) {
      toast.error('Failed to create new thread');
    }
  };

  // Add global keyboard shortcut for focusing the chat input
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
      if (e.key === '/' && !chatIsLoading) {
        e.preventDefault();
        chatInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chatIsLoading]);

  // Update prefetching effect
  useEffect(() => {
    // Prefetch common routes
    router.prefetch('/chat');
    router.prefetch('/auth');
    
    // If user is authenticated, prefetch their chat threads
    if (user) {
      const recentThreads = localStorage.getItem('recentThreads');
      if (recentThreads) {
        JSON.parse(recentThreads).forEach((threadId: string) => {
          router.prefetch(`/chat/${threadId}`);
        });
      }
    }
  }, [user, router]);

  // Step 2: Callback for ChatInput to report its active files height
  const handleActiveFilesHeightChange = useCallback((height: number) => {
    // console.log('Reported active files height:', height); // Debug log
    setChatInputHeightOffset(height > 0 ? height + 8 : 0); // Add some padding if height > 0
  }, []);

  return (
    <main className="flex min-h-screen flex-col">
      {/* Header - Mobile only */}
<div className="md:hidden">
  <Header toggleSidebar={toggleSidebar} />
</div>
{/* Fixed Ayle Logo - Desktop only */}
<Link
  href="/"
  className="hidden md:flex fixed top-4 left-4 z-50 items-center transition-colors duration-200 hover:text-[#121212] dark:hover:text-[#ffffff]"
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
      {/* <Header toggleSidebar={toggleSidebar} /> */}
      <DynamicSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onSignInClick={openAuthDialog}
        refreshTrigger={refreshSidebar}
      />
      
      {!hasMessages ? (
        <>
          <MobileSearchUI 
            input={input}
            handleInputChange={(e: any) => handleInputChange(e)}
            handleSubmit={e => { e.preventDefault(); handleSubmit(e); }}
            isLoading={chatIsLoading}
            selectedModel={selectedModel}
            handleModelChange={handleModelChange}
            models={models}
            setInput={setInput}
            messages={messages}
            description={description}
            onAttachmentsChange={setAttachments}
          />
          <DesktopSearchUI 
            input={input}
            handleInputChange={(e: any) => handleInputChange(e)}
            handleSubmit={e => { e.preventDefault(); handleSubmit(e); }}
            isLoading={chatIsLoading}
            selectedModel={selectedModel}
            handleModelChange={handleModelChange}
            models={models}
            setInput={setInput}
            description={description}
            messages={messages}
            onAttachmentsChange={setAttachments}
          />
        </>
      ) : (
        <>
          <ChatMessages 
            messages={messages as any[]}
            isLoading={chatIsLoading}
            selectedModel={selectedModel}
            selectedModelObj={selectedModelObj}
            isExa={isExa}
            currentThreadId={currentThreadId}
            bottomPadding={chatInputHeightOffset}
          />

          {hasMessages && (
            <DynamicChatInput 
              ref={chatInputRef}
              input={input}
              handleInputChange={(e: any) => handleInputChange(e)}
              handleSubmit={handleSubmit}
              isLoading={chatIsLoading}
              selectedModel={selectedModel}
              handleModelChange={handleModelChange}
              models={models}
              isExa={isExa}
              onNewChat={handleNewChat}
              onAttachmentsChange={setAttachments}
              activeChatFiles={activeChatFiles}
              removeActiveFile={removeActiveFile}
              onActiveFilesHeightChange={handleActiveFilesHeightChange}
            />
          )}
        </>
      )}
{/* Fixed Theme Toggle - Desktop only */}
<div className="hidden md:block fixed bottom-4 left-4 z-50">
  <ThemeToggle />
</div>
    </main>
  );
}

// Main Page component with Suspense boundary
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageContent />
    </Suspense>
  );
}
 