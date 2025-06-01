'use client';

import { useState, useRef, useEffect, Suspense, useCallback, useMemo } from 'react';
import { Message, Model, ModelType, FileAttachment } from '../../types';
import { useChat, CreateMessage } from '@ai-sdk/react';
import Header from '../../component/Header';
import ChatMessages from '../../component/ChatMessages';
import ChatInput, { ChatInputHandle } from '../../component/ChatInput';
import Sidebar from '../../component/Sidebar';
import { fetchResponse, scrapeUrlContent } from '../../api/apiService'; // Added scrapeUrlContent
import modelsData from '../../../models.json';
import { AuthDialog } from '@/components/AuthDialog';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ChatThread } from '@/lib/redis';
import { toast } from 'sonner';
import QueryEnhancer from '../../component/QueryEnhancer';
import React from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function ChatThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const [localMessages, setLocalMessages] = useState<Message[]>([]); // For image gen and initial load
  // const [input, setInput] = useState(''); // Replaced by useChat
  // const [isLoading, setIsLoading] = useState(false); // Replaced by useChat
  const [isThreadLoading, setIsThreadLoading] = useState(true);
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
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [refreshSidebar, setRefreshSidebar] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null); // Still used by fetchResponse in image gen
  const scrapeAbortControllerRef = useRef<AbortController | null>(null); // For scrapeUrlContent
  const { user, session } = useAuth();
  const router = useRouter();
  const threadId = React.use(params).threadId;
  const chatInputRef = useRef<ChatInputHandle>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [activeChatFiles, setActiveChatFiles] = useState<Array<{ name: string; type: string; uri: string }>>([]);
  const [chatInputHeightOffset, setChatInputHeightOffset] = useState(0);

  const isAuthenticated = !!user;

  const {
    messages: chatMessagesFromHook, // Renamed to avoid conflict with component's 'messages'
    input,
    handleInputChange,
    append,
    isLoading: chatIsLoading,
    error: chatError,
    stop: stopChat,
    reload: reloadChat,
    setMessages: setChatMessages,
  } = useChat({
    api: '/api/ai',
    id: threadId, // Pass the current threadId
    initialMessages: [], // Will be set after thread data is fetched
    sendExtraMessageFields: true, // If backend needs message IDs, createdAt
    onFinish: async (message) => { // message is the assistant's final message
      if (user && isAuthenticated && threadId) {
        // Use the helper to get the latest messages
        await updateThread(get().chatMessagesFromHook, selectedModel);
      }
    },
    onError: (err) => {
      toast.error(err.message || 'An error occurred during chat.');
    }
  });

  // Helper to get latest messages for onFinish, as chatMessagesFromHook in onFinish closure might be stale
  const get = () => ({ chatMessagesFromHook });

  // Combine messages from useChat with local messages for display
  const messages = useMemo(() => {
    // If chatMessagesFromHook has items, it's the primary source after initial load.
    // localMessages is used for initial load and potentially image generation if it doesn't go through useChat.
    return chatMessagesFromHook.length > 0 ? chatMessagesFromHook : localMessages;
  }, [chatMessagesFromHook, localMessages]);


  useEffect(() => {
    // Add models from different providers
    const groqModels = modelsData.models.filter(model => model.providerId === 'groq');
    const googleModels = modelsData.models.filter(model => model.providerId === 'google');
    const openRouterModels = modelsData.models.filter(model => model.providerId === 'openrouter');
    const cerebrasModels = modelsData.models.filter(model => model.providerId === 'cerebras');
    const xaiModels = modelsData.models.filter(model => model.providerId === 'xai');
    const togetherModels = modelsData.models.filter(model => model.providerId === 'together');
    // Replace the model list instead of appending
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
  }, []);

  useEffect(() => {
    const fetchThread = async () => {
      if (thread && thread.id === threadId && chatMessagesFromHook.length > 0) { // Check if useChat already loaded
        setIsThreadLoading(false);
        return;
      }

      try {
        setIsThreadLoading(true);
        const timestamp = Date.now();
        const response = await fetch(`/api/chat/threads/${threadId}?t=${timestamp}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 401) {
            setIsThreadLoading(false);
            // Potentially redirect or show error if thread not found/accessible
            if (response.status === 404) toast.error("Chat thread not found.");
            else if (response.status === 401) toast.error("Unauthorized to view this chat.");
            router.push('/'); // Redirect to home if thread is not accessible
            return;
          }
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success && data.thread) {
          setThread(data.thread);
          // Set initial messages for both useChat and localMessages (for consistency if local is used)
          setChatMessages(data.thread.messages || []);
          setLocalMessages(data.thread.messages || []);
          if (data.thread.model) {
            setSelectedModel(data.thread.model as ModelType);
          }
        } else {
          console.error('Failed to load thread:', data.error);
          toast.error(data.error || "Failed to load chat data.");
        }
      } catch (error) {
        console.error('Error loading thread:', error);
        toast.error(error instanceof Error ? error.message : "An unknown error occurred while loading the chat.");
      } finally {
        setIsThreadLoading(false);
      }
    };

    if (threadId) {
      fetchThread();
    }
  }, [threadId, thread, setChatMessages, router]); // Added setChatMessages and router to dependencies

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

  // Step 2: Callback for ChatInput to report its active files height
  const handleActiveFilesHeightChange = useCallback((height: number) => {
    // console.log('Reported active files height:', height); // Debug log
    setChatInputHeightOffset(height > 0 ? height + 8 : 0); // Add some padding if height > 0
  }, []);

  // Add global keyboard shortcut for focusing the chat input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if we're in an input field or textarea already
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      // Focus chat input when "/" is pressed
      // Use chatIsLoading from useChat
      if (e.key === '/' && !chatIsLoading) {
        e.preventDefault();
        chatInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chatIsLoading]); // Use chatIsLoading

  // handleInputChange is now from useChat
  // setInput is implicitly handled by useChat's handleInputChange

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId as ModelType);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleSubmit = async (e: React.FormEvent, submitAttachments?: File[]) => { // Renamed files to submitAttachments
    e.preventDefault();
    // Use input from useChat and chatIsLoading
    if ((!input.trim() && (!submitAttachments || submitAttachments.length === 0)) || chatIsLoading) return;

    if (!isAuthenticated) {
      toast.error('Please sign in to chat', {
        description: 'You can sign in using the sidebar or homepage'
      });
      return;
    }

    let processedAttachments: FileAttachment[] | undefined = undefined;
    if (submitAttachments && submitAttachments.length > 0) {
      processedAttachments = submitAttachments.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
      }));
    }

    // URL Scraping Logic
    const trimmedInput = input.trim(); // input from useChat
    let finalInput = trimmedInput;
    const URL_REGEX = /(https?:\/\/[^\s]+)/g;
    const detectedUrls = trimmedInput.match(URL_REGEX);

    if (detectedUrls && detectedUrls.length > 0 && selectedModel !== 'exa') {
      const urlToScrape = detectedUrls[0];
      scrapeAbortControllerRef.current = new AbortController();
      try {
        // Show toast while scraping
        const scrapePromise = scrapeUrlContent(urlToScrape, scrapeAbortControllerRef.current);
        toast.promise(scrapePromise, {
          loading: 'Analyzing URL...',
          success: (content) => {
            if (content) {
              finalInput = `USER QUESTION: "${trimmedInput}"\n\nADDITIONAL CONTEXT FROM SCRAPED URL (${urlToScrape}):\n---\n${content}\n---\n\nBased on the user question and the scraped context above, please provide an answer.`;
              return "URL content will be used.";
            }
            return "Proceeding with original query.";
          },
          error: "Failed to scrape URL content."
        });
        const scrapedContent = await scrapePromise;
        if (scrapedContent) {
           finalInput = `USER QUESTION: "${trimmedInput}"\n\nADDITIONAL CONTEXT FROM SCRAPED URL (${urlToScrape}):\n---\n${scrapedContent}\n---\n\nBased on the user question and the scraped context above, please provide an answer.`;
        }
      } catch (scrapeError) {
        console.error("Error scraping URL:", scrapeError);
        // Toast is already handled by toast.promise
      } finally {
        scrapeAbortControllerRef.current = null;
      }
    }
    // End URL Scraping

    // abortControllerRef is for fetchResponse, useChat handles its own aborting.

    const modelObj = models.find(m => m.id === selectedModel);
    const isImageGenerationModel = modelObj?.imageGenerationMode === true;

    try {
      if (isImageGenerationModel) {
        console.log("Using image generation model:", modelObj?.name, "Provider:", modelObj?.providerId);
        // This flow remains separate and uses localMessages and setLocalMessages.
        const userMessageForImage: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content: finalInput, // Use finalInput
          attachments: processedAttachments
        };
        const assistantPlaceholderForImage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '...',
          provider: selectedModelObj?.provider,
        };

        // Optimistically update localMessages
        setLocalMessages(prev => [...prev, userMessageForImage, assistantPlaceholderForImage]);
        // setIsLoading(true); // Use a local loading state for image gen if needed, chatIsLoading is separate

        // Call fetchResponse (or a dedicated image gen service if refactored)
        // For now, assuming fetchResponse can handle image generation models based on selectedModel
        const response = await fetchResponse(
          finalInput, // userMessage.content
          localMessages, // Pass current localMessages
          selectedModel,
          abortControllerRef.current = new AbortController(), // New abort controller for this specific call
          setLocalMessages, // To update UI during stream IF fetchResponse supports it for images
          assistantPlaceholderForImage,
          submitAttachments, // Pass original File[]
          activeChatFiles,
          handleFileUploaded
        );

        const completedAssistantMessage: Message = {
          ...assistantPlaceholderForImage,
          content: response.content || 'Here is the generated image:',
          images: response.images || [],
          completed: true,
          provider: selectedModelObj?.provider
        };

        setLocalMessages(prev => prev.map(msg => msg.id === assistantPlaceholderForImage.id ? completedAssistantMessage : msg));

        if (user && isAuthenticated && threadId) {
          // Use the state of localMessages after it has been updated
          const finalLocalMessages = [...localMessages.filter(m => m.id !== assistantPlaceholderForImage.id), completedAssistantMessage];
          await updateThread(finalLocalMessages, selectedModel);
        }
        // setIsLoading(false); // Reset local loading state for image gen
      } else {
        // Regular Text Response Flow using useChat.append
        const userMessageToSend: CreateMessage = {
          role: 'user' as const,
          content: finalInput,
          // attachments for useChat might need a specific format if not handled by `body`
        };

        const appendOptionsBody = {
          selectedModel: selectedModel,
          activeChatFiles: activeChatFiles,
          attachments: processedAttachments
          // threadId is implicitly handled by useChat's `id` option
        };

        append(userMessageToSend, { body: appendOptionsBody });
        // Optimistic UI, error handling, and onFinish (for updateThread) are managed by useChat.
      }
    } catch (error: any) {
      // This catch block would primarily handle errors from URL scraping or image gen setup if they're not caught internally.
      console.error("Error in handleSubmit outer try-catch:", error);
      toast.error(`Error: ${error.message || 'Something went wrong.'}`);
      // setIsLoading(false); // Reset local loading state for image gen
    } finally {
      // setIsLoading(false); // Reset local loading state for image gen
      setAttachments([]); // Clear attachments from the input component
      // abortControllerRef.current = null; // Only nullify if it was for fetchResponse
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

  // Update thread in database
  // Ensure modelForUpdate is consistently passed and used.
  const updateThread = async (messagesToUpdate: Message[], modelForUpdate: ModelType) => {
    if (!isAuthenticated || !user || !threadId) {
      return false;
    }

    try {
      const timestamp = Date.now();
      const response = await fetch(`/api/chat/threads/${threadId}?t=${timestamp}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        credentials: 'include',
        body: JSON.stringify({
          messages: messagesToUpdate, // Use the passed messages
          model: modelForUpdate // Use the passed model
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          // No need to refresh, just show auth dialog
          setShowAuthDialog(true);
          setIsThreadLoading(false);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        // Update sidebar to reflect changes
        setRefreshSidebar(prev => prev + 1);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error updating thread:', error);
      return false;
    }
  };

  if (isThreadLoading) {
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
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onSignInClick={() => setShowAuthDialog(true)}
        />
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center space-y-4">
            <div className="flex space-x-2 mt-2">
              <div className="w-3 h-3 bg-[var(--brand-darker)] animate-[bounce_0.6s_infinite_0.1s]"></div>
              <div className="w-3 h-3 bg-[var(--brand-darker)] animate-[bounce_0.6s_infinite_0.2s]"></div>
              <div className="w-3 h-3 bg-[var(--brand-darker)] animate-[bounce_0.6s_infinite_0.3s]"></div>
            </div>
            <div className="text-gray-600 font-medium">Loading conversation...</div>
          </div>
        </div>
        {/* Fixed Theme Toggle - Desktop only */}
        <div className="hidden md:block fixed bottom-4 left-4 z-50">
          <ThemeToggle />
        </div>
      </main>

    );
  }

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
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSignInClick={() => setShowAuthDialog(true)}
        refreshTrigger={refreshSidebar}
      />

      <ChatMessages
        messages={messages} // Already using the memoized version
        isLoading={chatIsLoading} // Use chatIsLoading
        selectedModel={selectedModel}
        selectedModelObj={selectedModelObj}
        isExa={selectedModel === 'exa'}
        currentThreadId={threadId}
        bottomPadding={chatInputHeightOffset}
      />

      <ChatInput
        ref={chatInputRef}
        input={input} // from useChat
        handleInputChange={handleInputChange} // from useChat
        handleSubmit={(e) => handleSubmit(e, attachments)} // attachments is from local state for <input type="file">
        isLoading={chatIsLoading} // from useChat
        selectedModel={selectedModel}
        handleModelChange={handleModelChange}
        models={models}
        isExa={selectedModel === 'exa'}
        onNewChat={handleNewChat}
        onAttachmentsChange={setAttachments}
        activeChatFiles={activeChatFiles}
        removeActiveFile={removeActiveFile}
        onActiveFilesHeightChange={handleActiveFilesHeightChange}
      />

      {/* Auth Dialog */}
      <AuthDialog
        isOpen={showAuthDialog}
        onClose={() => setShowAuthDialog(false)}
        onSuccess={() => {
          setRefreshSidebar(prev => prev + 1);
          // Reload the thread data
          if (threadId) {
            setIsThreadLoading(true);
            const fetchData = async () => {
              try {
                // Add a timestamp to ensure we don't get a cached response
                const timestamp = Date.now();
                const response = await fetch(`/api/chat/threads/${threadId}?t=${timestamp}`, {
                  cache: 'no-store',
                  credentials: 'include'
                });

                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data.thread) {
                  setThread(data.thread);
                  setMessages(data.thread.messages || []);
                  setSelectedModel(data.thread.model || 'exa');
                }
              } catch (error) {
                console.error('Error fetching thread:', error);
                toast.error('Failed to load chat. Please try again.');
              } finally {
                setIsThreadLoading(false);
              }
            };

            fetchData();
          }
        }}
      />
      {/* Fixed Theme Toggle - Desktop only */}
      <div className="hidden md:block fixed bottom-4 left-4 z-50">
        <ThemeToggle />
      </div>
    </main>
  );
} 