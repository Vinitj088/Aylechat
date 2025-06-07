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
import { ChatThread } from '@/lib/redis';
import { toast } from 'sonner';
import QueryEnhancer from '../../component/QueryEnhancer';
import React from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useThreadCache } from '@/context/ThreadCacheContext';

export default function ChatThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, session } = useAuth();
  const router = useRouter();
  const threadId = React.use(params).threadId;
  const chatInputRef = useRef<ChatInputHandle>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [activeChatFiles, setActiveChatFiles] = useState<Array<{ name: string; type: string; uri: string }>>([]);
  const [chatInputHeightOffset, setChatInputHeightOffset] = useState(0);
  const { threads: cachedThreads, updateThread } = useThreadCache();
  const [quotedText, setQuotedText] = useState('');

  const isAuthenticated = !!user;

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
    // Try to use cached thread first
    const cachedThread = cachedThreads.find(t => t.id === threadId);
    if (cachedThread) {
      setThread(cachedThread);
      setMessages(cachedThread.messages || []);
      if (cachedThread.model) {
        setSelectedModel(cachedThread.model as ModelType);
      }
      setIsThreadLoading(false);
      return;
    }
    // If not in cache, fetch from API
    const fetchThread = async () => {
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
            return;
          }
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.success && data.thread) {
          setThread(data.thread);
          setMessages(data.thread.messages || []);
          if (data.thread.model) {
            setSelectedModel(data.thread.model as ModelType);
          }
        } else {
          console.error('Failed to load thread:', data.error);
        }
      } catch (error) {
        console.error('Error loading thread:', error);
      } finally {
        setIsThreadLoading(false);
      }
    };
    if (threadId) {
      fetchThread();
    }
  }, [threadId, thread, cachedThreads]);

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
      if (e.key === '/' && !isLoading) {
        e.preventDefault();
        chatInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement> | string) => {
    // Check if e is a string or an event object
    const value = typeof e === 'string' ? e : e.target.value;
    setInput(value);
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId as ModelType);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleSubmit = async (e: React.FormEvent, files?: File[]) => {
    e.preventDefault();
    if ((!input.trim() && (!files || files.length === 0)) || isLoading) return;

    // Block requests if user is not authenticated with just a toast
    if (!isAuthenticated) {
      toast.error('Please sign in to chat', {
        description: 'You can sign in using the sidebar or homepage'
      });
      return;
    }

    // Debug log for attachments
    if (files && files.length > 0) {
      console.log(`Processing ${files.length} attachment(s) for message:`,
        files.map(file => ({
          name: file.name,
          type: file.type,
          size: file.size
        }))
      );
    }

    const fullInput = quotedText && quotedText.trim().length > 0
      ? `> ${quotedText.replace(/\n/g, '\n> ')}\n\n${input.trim()}`
      : input.trim();

    // Create new user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(), // Only the user's input, not the quoted text
      ...(quotedText && quotedText.trim().length > 0 ? { quotedText } : {})
    };

    // Process attachments if any
    if (files && files.length > 0) {
      // Create simplified attachment info for display (no base64)
      userMessage.attachments = files.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        // data: '' // Removed: data is now optional in FileAttachment type
      }));
      console.log(`Added info for ${files.length} attachments to user message`);
    }

    // Create placeholder for assistant response
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      provider: selectedModelObj?.provider
    };

    // Update UI right away
    setInput('');
    setQuotedText('');
    setIsLoading(true);
    const updatedMessages = [...messages, userMessage, assistantMessage];
    setMessages(updatedMessages);

    // Cancel any previous requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    // Find the selected model object to check its capabilities
    const modelObj = models.find(m => m.id === selectedModel);
    const isImageGenerationModel = modelObj?.imageGenerationMode === true;

    try {
      // Check if it's a new thread or existing thread
      // const isNewThread = !threadId || threadId === 'new'; // We don't need this check here anymore

      // REMOVED: Update thread immediately - we now wait for the response
      // if (user && isAuthenticated) {
      //   await updateThread(updatedMessages); 
      // }

      if (isImageGenerationModel) {
        console.log("Using image generation model:", modelObj?.name, "Provider:", modelObj?.providerId);

        // Determine the API endpoint based on the provider
        let apiEndpoint = '/api/gemini'; // Default for Gemini models

        if (modelObj?.providerId === 'together') {
          apiEndpoint = '/api/together';
          console.log("Using Together AI endpoint for image generation");
        }

        // Handle image generation model
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          credentials: 'include',
          body: JSON.stringify({
            query: userMessage.content,
            model: selectedModel,
            prompt: userMessage.content, // Add prompt parameter for Together AI
            messages: updatedMessages.slice(0, -1) // Exclude the empty assistant message
          })
        });

        if (!response.ok) {
          throw new Error(`Response error: ${response.status}`);
        }

        const data = await response.json();

        // Debug the response
        console.log('Image generation client response:', {
          hasText: !!data.text,
          textLength: data.text?.length || 0,
          hasImages: !!data.images,
          imagesCount: data.images?.length || 0
        });

        // Verify images array is valid
        if (data.images && Array.isArray(data.images)) {
          console.log(`Received ${data.images.length} images from API`);
        } else {
          console.error('No valid images array in response:', data);
          data.images = []; // Ensure we have a valid array
        }

        // Process images for storage - if we have URLs, we can optimize storage
        const optimizedImages = data.images.map((img: { mimeType: string; data: string; url?: string }) => {
          // If the image has a URL, we can store just the URL and mime type
          if (img.url) {
            return {
              mimeType: img.mimeType,
              data: img.url,  // Store the URL in the data field for backward compatibility
              url: img.url    // Also keep the URL field
            };
          }
          // Otherwise keep the original image data
          return img;
        });

        // Update the assistant message with text and images
        const completedAssistantMessage: Message = {
          ...assistantMessage,
          content: data.text || 'Here is the generated image:',
          images: optimizedImages || [],
          completed: true,
          provider: selectedModelObj?.provider
        };

        // Debug the message being added
        console.log('Adding assistant message with images:', {
          messageId: completedAssistantMessage.id,
          hasImages: !!completedAssistantMessage.images,
          imagesCount: completedAssistantMessage.images?.length || 0,
          hasUrls: completedAssistantMessage.images?.some(img => !!img.url) || false
        });

        // Update messages state with completed response
        setMessages(prevMessages => {
          const updatedMessages = prevMessages.map(msg =>
            msg.id === assistantMessage.id
              ? completedAssistantMessage
              : msg
          );
          return updatedMessages;
        });

        // Update the thread again with the completed response
        if (user && isAuthenticated) {
          try {
            // Construct final messages using the completedAssistantMessage from image gen
            const finalMessages = updatedMessages.map(msg =>
              msg.id === assistantMessage.id
                ? completedAssistantMessage // Use the object with image data
                : msg
            );
            await updateThreadInDb(finalMessages);
            // Update the thread in the cache directly, filter out 'system' messages
            updateThread(threadId, { messages: finalMessages.filter(m => m.role === 'user' || m.role === 'assistant') as import('@/lib/redis').Message[] });
          } catch (updateError) {
            console.error('Error saving completed thread (image gen):', updateError);
          }
        }
      } else {
        // Standard text model processing
        // REMOVED: let content = "";
        // REMOVED: let citations: any[] = [];

        // Fetch the model response - it now returns the complete assistant message
        const completedAssistantMessage = await fetchResponse(
          fullInput,
          updatedMessages.slice(0, -1), // Pass messages before placeholder
          selectedModel,
          abortControllerRef.current,
          setMessages, // Still needed for live UI updates during stream
          assistantMessage, // Pass the placeholder ID/role
          files,
          activeChatFiles,
          handleFileUploaded
        );

        // REMOVED: content = response.content;
        // REMOVED: citations = response.citations || [];

        // Update the thread again with the completed response
        if (user && isAuthenticated) {
          try {
            // Construct final messages using the returned completedAssistantMessage
            const finalMessages = updatedMessages.map(msg =>
              msg.id === assistantMessage.id
                ? completedAssistantMessage // Use the object returned by fetchResponse
                : msg
            );
            await updateThreadInDb(finalMessages);
            // Update the thread in the cache directly, filter out 'system' messages
            updateThread(threadId, { messages: finalMessages.filter(m => m.role === 'user' || m.role === 'assistant') as import('@/lib/redis').Message[] });
          } catch (updateError) {
            console.error('Error saving completed thread (text gen):', updateError);
          }
        }
      }
    } catch (error: any) {
      console.error("Error in submission:", error);

      // Handle authentication errors
      if (error.message && (
        error.message.includes('authentication') ||
        error.message.includes('Authentication') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('401') ||
        error.message.includes('session')
      )) {
        // Show the auth dialog first to let the user sign in
        setShowAuthDialog(true);

        // Set the error message in the assistant message
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === assistantMessage.id
              ? { ...msg, content: "I couldn't complete your request because your session expired. Please sign in again.", completed: true }
              : msg
          )
        );
      } else {
        // Handle other errors
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === assistantMessage.id
              ? { ...msg, content: "I'm sorry, there was an error processing your request. Please try again.", completed: true }
              : msg
          )
        );

        // Show error toast
        toast.error(error.message || 'Error processing request');
      }
    } finally {
      // Clear the abort controller reference
      abortControllerRef.current = null;

      // Always ensure loading is stopped, regardless of outcome
      setIsLoading(false);
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

  // Update thread in database (renamed to avoid confusion)
  const updateThreadInDb = async (updatedMessages: Message[]) => {
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
          messages: updatedMessages,
          model: selectedModel
        })
      });
      if (!response.ok) {
        if (response.status === 401) {
          setShowAuthDialog(true);
          setIsThreadLoading(false);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        // Only trigger sidebar refresh if a thread was created or deleted
        // setRefreshSidebar(prev => prev + 1); // REMOVE THIS
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
        <div className="lg:hidden">
          <Header toggleSidebar={toggleSidebar} />
        </div>
        {/* Fixed Ayle Logo - Desktop only */}
        <Link
          href="/"
          className="hidden lg:flex fixed top-4 left-4 z-50 items-center transition-colors duration-200 hover:text-[#121212] dark:hover:text-[#ffffff]"
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
        {/* ChatMessages skeleton or empty space while loading */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1">
            {/* Optionally, you can add a skeleton here for ChatMessages */}
          </div>
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
        {/* Fixed Theme Toggle - Desktop only, only for lg and up */}
        <div className="hidden lg:block fixed bottom-4 left-4 z-50">
          <ThemeToggle />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
         {/* Header - Mobile only */}
<div className="lg:hidden">
  <Header toggleSidebar={toggleSidebar} />
</div>
{/* Fixed Ayle Logo - Desktop only */}
<Link
  href="/"
  className="hidden lg:flex fixed top-4 left-4 z-50 items-center transition-colors duration-200 hover:text-[#121212] dark:hover:text-[#ffffff]"
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
        messages={messages}
        isLoading={isLoading}
        selectedModel={selectedModel}
        selectedModelObj={selectedModelObj}
        isExa={selectedModel === 'exa'}
        currentThreadId={threadId}
        bottomPadding={chatInputHeightOffset}
        onQuote={setQuotedText}
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
      {/* Fixed Theme Toggle - Desktop only, only for lg and up */}
      <div className="hidden lg:block fixed bottom-4 left-4 z-50">
        <ThemeToggle />
      </div>
    </main>
  );
} 