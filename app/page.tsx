'use client';

import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Message, Model, ModelType, FileAttachment } from './types';
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
import { useSidebarPin } from '../context/SidebarPinContext';
import useIsMobile from './hooks/useIsMobile';
import { QueryEnhancerProvider, useQueryEnhancer } from '@/context/QueryEnhancerContext';
import { db } from '@/lib/db';
import { id } from '@instantdb/react';
import { cn } from '@/lib/utils';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
  const { pinned, setPinned } = useSidebarPin();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [refreshSidebar, setRefreshSidebar] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, isLoading: authLoading, openAuthDialog } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatInputRef = useRef<ChatInputHandle>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [activeChatFiles, setActiveChatFiles] = useState<Array<{ name: string; type: string; uri: string }>>([]);
  const [chatInputHeightOffset, setChatInputHeightOffset] = useState(0);
  const GUEST_MESSAGE_LIMIT = 3;
  const GUEST_MESSAGE_KEY = 'guestMessageCount';
  const [guestMessageCount, setGuestMessageCount] = useState(0);
  const [guestCountLoaded, setGuestCountLoaded] = useState(false);
  const isGuest = !user;
  const prevGuestMessageCount = useRef(guestMessageCount);
  const [quotedText, setQuotedText] = useState('');
  const [retriedMessageId, setRetriedMessageId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const { enhancerMode } = useQueryEnhancer();

  const isAuthenticated = !!user;

  // Prefetch API modules and data when the app loads
  useEffect(() => {
    // Prefetch all API modules and data for faster initial response times
    prefetchAll().catch(() => {
      // Silently ignore prefetch errors as this is just an optimization
    });
  }, []);

  

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
      
      ...googleModels,
      ...cerebrasModels,
      ...openRouterModels,
      ...groqModels,
      ...togetherModels,
      ...xaiModels
    ]);
    
    // Get search params
    const searchParams = new URLSearchParams(window.location.search);
    const modelParam = searchParams.get('model');
    
    if (modelParam) {
      setSelectedModel(modelParam);
    }
  }, []);

  
  
  // Handle initial URL search parameters for search engine functionality
  useEffect(() => {
    // Only run this once when the component mounts and there are no messages yet
    if (messages.length === 0 && !isLoading) {
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
            const userMessage: Message = {
              id: crypto.randomUUID(),
              role: 'user',
              content: decodedQuery,
              createdAt: new Date(),
              ...(quotedText && quotedText.trim().length > 0 ? { quotedText } : {})
            };

            const assistantMessage: Message = {
              id: `ai-${Date.now()}`,
              role: 'assistant',
              content: '...',
              createdAt: new Date(Date.now() + 1000),
              provider: selectedModelObj?.provider,
            };

            setIsLoading(true);
            setMessages([userMessage, assistantMessage]);

            try {
              const controller = new AbortController();
              abortControllerRef.current = controller;
              
              // Call fetchResponse and capture the complete message object
              const completedAssistantMessage = await fetchResponse(
                decodedQuery,
                [],
                'exa', // Always use Exa for search queries
                controller,
                setMessages, // Pass setMessages for live updates
                assistantMessage, // Pass the placeholder
                attachments,
                activeChatFiles,
                handleFileUploaded
              );

              // Update messages with final response using the returned object
              const finalMessages = [userMessage, completedAssistantMessage]; // Use the completed message directly
              
              setMessages(finalMessages);
              
              // Don't create a thread for URL search queries
              // This keeps browser search queries from being saved
              
              setIsLoading(false);
              abortControllerRef.current = null;
            } catch (error: any) {
              console.error('Error performing search:', error);
              setIsLoading(false);
              
              // Handle error display
              const updatedMessages = [userMessage, {
                ...assistantMessage,
                content: `Error: ${error.message || 'Failed to perform search. Please try again.'}`,
                completed: true
              }];
              
              setMessages(updatedMessages);
              abortControllerRef.current = null;
            }
          }
        }, 800); // Increased delay for better reliability
        
        return () => clearTimeout(timer);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

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
    if (!input.trim() && attachments.length === 0) return;

    const fullInput = quotedText && quotedText.trim().length > 0
      ? `> ${quotedText.replace(/\n/g, '\n> ')}\n\n${input}`
      : input;

    // Guest logic: allow up to 3 real AI messages, then block
    if (isGuest) {
      if (guestMessageCount >= GUEST_MESSAGE_LIMIT) {
        openAuthDialog();
        return;
      }
      // Add the user message to the messages array (temporary, not persisted)
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: input, // Only the user's input, not the quoted text
        createdAt: new Date(),
        ...(quotedText && quotedText.trim().length > 0 ? { quotedText } : {})
      };
      if (attachments.length > 0) {
        userMessage.attachments = attachments.map(file => ({
          name: file.name,
          type: file.type,
          size: file.size,
        }));
      }
      setInput('');
      setQuotedText('');
      setIsLoading(true);
      // Add user message and placeholder assistant message
      const assistantMessage: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: '...',
        createdAt: new Date(Date.now() + 1000)
      };
      setMessages(prev => [...prev, userMessage, assistantMessage]);
      setGuestMessageCount(count => {
        const newCount = count + 1;
        if (typeof window !== 'undefined') {
          localStorage.setItem(GUEST_MESSAGE_KEY, newCount.toString());
        }
        return newCount;
      });
      try {
        abortControllerRef.current = new AbortController();
        const completedAssistantMessage = await fetchResponse(
          fullInput,
          messages,
          selectedModel,
          abortControllerRef.current,
          (updatedMessages: Message[]) => {
            setMessages(updatedMessages);
          },
          assistantMessage,
          attachments,
          activeChatFiles,
          handleFileUploaded
        );
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessage.id ? completedAssistantMessage : msg
        ));
      } catch (error) {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessage.id ? { ...msg, content: 'Error: Failed to get response.' } : msg
        ));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // If not authenticated, show auth dialog and keep the message in the input
    if (!isAuthenticated || !user) {
      openAuthDialog();
      return;
    }

    // Add the user message to the messages array
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input, // Only the user's input, not the quoted text
      createdAt: new Date(),
      ...(quotedText && quotedText.trim().length > 0 ? { quotedText } : {})
    };

    // Process attachments if any and add them to the user message
    if (attachments.length > 0) {
      // Create simplified attachment info for display (no base64)
      userMessage.attachments = attachments.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
      }));
    }

    // Create an assistant message placeholder
    const assistantMessage: Message = {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: '...',
      createdAt: new Date(Date.now() + 1000),
      provider: selectedModelObj?.provider,
    };

    // Clear the input field and update the messages state
    setInput('');
    setQuotedText('');
    setIsLoading(true);
    setMessages(prev => [...prev, userMessage, assistantMessage]);

    try {
      // Use abort controller to cancel the request if needed
      abortControllerRef.current = new AbortController();
      
      // Generate automatic chat thread title 
      const isFirstMessage = messages.length === 0;
      let threadTitle: string | undefined = undefined;
      
      if (isFirstMessage) {
        // Use the first 50 chars of the message as the title
        threadTitle = input.substring(0, 50) + (input.length > 50 ? '...' : '');
      }

      // Find the selected model object to check its capabilities
      const modelObj = models.find(m => m.id === selectedModel);
      const isImageGenerationModel = modelObj?.imageGenerationMode === true;

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
            query: fullInput,
            model: selectedModel,
            prompt: userMessage.content, // Add prompt parameter for Together AI
            messages: messages, // Send all previous messages for context
            attachments: attachments,
            activeChatFiles: activeChatFiles
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
        const optimizedImages = data.images.map((img: { mimeType: string; data: string; url?: string | null }) => {
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
          completed: true
        };
        
        // Debug the message being added
        console.log('Adding assistant message with images:', {
          messageId: completedAssistantMessage.id,
          hasImages: !!completedAssistantMessage.images,
          imagesCount: completedAssistantMessage.images?.length || 0,
          hasUrls: completedAssistantMessage.images?.some(img => !!img.url) || false
        });
        
        // Update messages with the new assistant message containing images
        const finalMessages = [...messages, userMessage, completedAssistantMessage];
        setMessages(finalMessages);
        
        // Create or update the thread with image data
        if (isFirstMessage) {
          // For first message, create a new thread with image data
          const threadId = id();
          const now = new Date();
          const messageIds = finalMessages.map(() => id());
          const transactions = [
            db.tx.threads[threadId]
              .update({
                title: threadTitle,
                model: selectedModel,
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
                isPublic: false,
              })
              .link({ user: user.id, messages: messageIds }),
            ...finalMessages.map((message, i) => 
              db.tx.messages[messageIds[i]]
                .update({
                  role: message.role,
                  content: message.content,
                  createdAt: message.createdAt ? (typeof message.createdAt === 'string' ? message.createdAt : message.createdAt.toISOString()) : undefined,
                  citations: message.citations,
                  completed: message.completed,
                  startTime: message.startTime,
                  endTime: message.endTime,
                  tps: message.tps,
                  mediaData: message.mediaData,
                  weatherData: message.weatherData,
                  images: message.images,
                  attachments: message.attachments,
                  provider: message.provider,
                  quotedText: message.quotedText,
                })
                .link({ thread: threadId })
            )
          ];
          await db.transact(transactions);
          setCurrentThreadId(threadId);
          window.history.pushState({}, '', `/chat/${threadId}`);
        }
        
        // Reset loading state
        setIsLoading(false);
        abortControllerRef.current = null;
        return; // Exit early, we're done with image generation
      }

      // Regular text response flow - only execute this if not an image generation model
      // Capture the complete assistant message object from fetchResponse
      const completedAssistantMessage = await fetchResponse(
        fullInput,
        messages, // Pass current messages state for context
        selectedModel,
        abortControllerRef.current,
        (updatedMessages: Message[]) => {
          // This callback updates messages as they stream in
          setMessages(updatedMessages);
        },
        assistantMessage, // Pass the placeholder message
        attachments,
        activeChatFiles,
        handleFileUploaded,
        enhancerMode
      );

      // Update messages state with the final, completed assistant message
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === assistantMessage.id 
            ? completedAssistantMessage // Replace placeholder with the complete message
            : msg
        )
      );

      // Construct the final message list for thread saving
      const finalMessagesForThread = [...messages, userMessage, completedAssistantMessage];

      // Create or update the thread only after we have the complete response
      if (isFirstMessage) {
        const threadId = id();
        const now = new Date();
        const messageIds = finalMessagesForThread.map(() => id());
        const transactions = [
          db.tx.threads[threadId]
            .update({
              title: threadTitle,
              model: selectedModel,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
              isPublic: false,
            })
            .link({ user: user.id, messages: messageIds }),
          ...finalMessagesForThread.map((message, i) => 
            db.tx.messages[messageIds[i]]
              .update({
                role: message.role,
                content: message.content,
                createdAt: message.createdAt ? (typeof message.createdAt === 'string' ? message.createdAt : message.createdAt.toISOString()) : undefined,
                citations: message.citations,
                completed: message.completed,
                startTime: message.startTime,
                endTime: message.endTime,
                tps: message.tps,
                mediaData: message.mediaData,
                weatherData: message.weatherData,
                images: message.images,
                attachments: message.attachments,
                provider: message.provider,
                quotedText: message.quotedText,
              })
              .link({ thread: threadId })
          )
        ];
        await db.transact(transactions);
        setCurrentThreadId(threadId);
        window.history.pushState({}, '', `/chat/${threadId}`);
      } else if (currentThreadId) {
        const now = new Date();
        const messageIds = finalMessagesForThread.slice(messages.length).map(() => id());
        const transactions = [
          db.tx.threads[currentThreadId]
            .update({
              updatedAt: now.toISOString(),
            }),
          ...finalMessagesForThread.slice(messages.length).map((message, i) => 
            db.tx.messages[messageIds[i]]
              .update({
                role: message.role,
                content: message.content,
                createdAt: message.createdAt ? (typeof message.createdAt === 'string' ? message.createdAt : message.createdAt.toISOString()) : undefined,
                citations: message.citations,
                completed: message.completed,
                startTime: message.startTime,
                endTime: message.endTime,
                tps: message.tps,
                mediaData: message.mediaData,
                weatherData: message.weatherData,
                images: message.images,
                attachments: message.attachments,
                provider: message.provider,
                quotedText: message.quotedText,
              })
              .link({ thread: currentThreadId })
          )
        ];
        await db.transact(transactions);
      }
      
      // Reset loading state after successful response
      setIsLoading(false);
      abortControllerRef.current = null;
    } catch (error: any) {
      console.error('Error fetching response:', error);
      
      // Add the error message to the assistant's message
      const updatedMessages = [...messages];
      const assistantMessageIndex = updatedMessages.length - 1;
      
      // Check if it's an auth error
      if (
        (error.message && error.message.toLowerCase().includes('unauthorized')) ||
        (error.message && (error.message.includes('parse') || error.message.includes('JSON')))
      ) {
        // Update the message with auth error info
        updatedMessages[assistantMessageIndex] = {
          ...updatedMessages[assistantMessageIndex],
          content: 'I encountered an authentication error. Please try again after fixing your session.',
          completed: true
        };
      } else {
        // For other errors
        updatedMessages[assistantMessageIndex] = {
          ...updatedMessages[assistantMessageIndex],
          content: `Error: ${error.message || 'Something went wrong. Please try again.'}`,
          completed: true
        };
        
        toast.error('Error generating response');
      }
      
      setMessages(updatedMessages);
      setIsLoading(false);
      abortControllerRef.current = null;
    } finally {
      setIsLoading(false);
      // Clear attachments after submission
      setAttachments([]);
      // After new user+assistant pair is added, remove old retried pair if needed
      if (retriedMessageId) {
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === retriedMessageId);
          if (idx === -1) return prev;
          // Remove user and next assistant (if any)
          const newMessages = prev.slice(0, idx);
          if (prev[idx + 1] && prev[idx + 1].role === 'assistant') {
            return newMessages.concat(prev.slice(idx + 2));
          }
          return newMessages.concat(prev.slice(idx + 1));
        });
        setRetriedMessageId(null);
      }
    }
  };
  
  // Function to handle login button click
  const handleLoginClick = useCallback(() => {
    openAuthDialog();
  }, [openAuthDialog]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement> | string) => {
    // Check if e is a string or an event object
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

  // Handle successful auth
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

  

  // Derived variables
  const isExa = selectedModel === 'exa';
  const selectedModelObj = models.find(model => model.id === selectedModel);
  const hasMessages = messages.length > 0;

  // Get the provider name for the selected model
  const providerName = selectedModelObj?.provider || 'AI';

  // Calculate the description based on model
  const description = isExa 
    ? 'Exa search uses embeddings to understand meaning.' 
    : getProviderDescription(providerName);

  const handleNewChat = () => {
    // Ensure we're at the top of the page
    window.scrollTo(0, 0);
    
    // Clear messages and reset state
    setMessages([]);
    setInput('');
    setCurrentThreadId(null);
    setActiveChatFiles([]);
    
    // Update router without full navigation for smoother transition
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

  // Optionally, on sign-in, clear the guest counter:
  useEffect(() => {
    if (user) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(GUEST_MESSAGE_KEY);
      }
    }
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(GUEST_MESSAGE_KEY);
      setGuestMessageCount(stored ? parseInt(stored, 10) : 0);
      setGuestCountLoaded(true);
    }
  }, []);

  useEffect(() => {
    // Only show toast if the count increased (i.e., after a message is sent)
    if (
      isGuest &&
      guestCountLoaded &&
      guestMessageCount > 0 &&
      guestMessageCount < GUEST_MESSAGE_LIMIT &&
      guestMessageCount > prevGuestMessageCount.current
    ) {
      toast.info(
        `${GUEST_MESSAGE_LIMIT - guestMessageCount} message${GUEST_MESSAGE_LIMIT - guestMessageCount === 1 ? '' : 's'} remaining`
      );
    }
    prevGuestMessageCount.current = guestMessageCount;
  }, [guestMessageCount, isGuest, guestCountLoaded]);

  // Retry logic: fill input, remove old user+assistant pair, focus input
  const handleRetryMessage = useCallback((message: Message) => {
    if (message.role !== 'user') return;
    setInput(message.content || '');
    setQuotedText(message.quotedText || '');
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === message.id);
      if (idx === -1) return prev;
      return prev.slice(0, idx);
    });
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 100);
  }, []);

  // --- Guest model filtering ---
  const guestModels = models.filter(
    (model) =>
      model.id === 'gemini-2.0-flash' ||
      model.id === 'gemini-2.5-flash' ||
      model.providerId === 'cerebras'
  );

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
    const aDate = typeof a.createdAt === 'string' ? a.createdAt : a.createdAt?.toISOString?.() || '';
    const bDate = typeof b.createdAt === 'string' ? b.createdAt : b.createdAt?.toISOString?.() || '';
    return new Date(aDate).getTime() - new Date(bDate).getTime();
  });

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
        {/* Sidebar: always render, for both guests and authenticated users */}
        <DynamicSidebar 
          isOpen={pinned || isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onSignInClick={openAuthDialog}
          refreshTrigger={refreshSidebar}
          pinned={pinned}
          setPinned={setPinned}
        />
        {!hasMessages ? (
          isMobile ? (
            <MobileSearchUI 
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              selectedModel={selectedModel}
              handleModelChange={handleModelChange}
              models={isGuest ? guestModels : models}
              setInput={setInput}
              messages={messages}
              description={description}
              onAttachmentsChange={setAttachments}
              isGuest={isGuest}
              guestMessageCount={guestMessageCount}
              guestMessageLimit={GUEST_MESSAGE_LIMIT}
              openAuthDialog={openAuthDialog}
            />
          ) : (
            <DesktopSearchUI 
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              selectedModel={selectedModel}
              handleModelChange={handleModelChange}
              models={isGuest ? guestModels : models}
              setInput={setInput}
              description={description}
              messages={messages}
              onAttachmentsChange={setAttachments}
              isGuest={isGuest}
              guestMessageCount={guestMessageCount}
              guestMessageLimit={GUEST_MESSAGE_LIMIT}
              openAuthDialog={openAuthDialog}
            />
          )
        ) : (
          <>
            <ChatMessages 
              messages={sortedMessages}
              isLoading={isLoading}
              selectedModel={selectedModel}
              selectedModelObj={selectedModelObj}
              isExa={isExa}
              currentThreadId={currentThreadId}
              bottomPadding={chatInputHeightOffset}
              onQuote={setQuotedText}
              onRetry={handleRetryMessage}
            />
            {/* Chat input: block for guest after 3 messages */}
            {(!isGuest || guestMessageCount < GUEST_MESSAGE_LIMIT) ? (
              hasMessages && (
                <DynamicChatInput 
                  ref={chatInputRef}
                  input={input}
                  handleInputChange={handleInputChange}
                  handleSubmit={handleSubmit}
                  isLoading={isLoading}
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
                  sidebarPinned={pinned}
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <p className="text-lg font-semibold mb-2">Sign in to unlock unlimited messages and advanced features</p>
                <button className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand-default)] dark:bg-[var(--brand-fainter)] border-2 border-[var(--secondary-darkest)] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[1px_1px_0px_0px_rgba(255,255,255,0.2)] transition-all" onClick={openAuthDialog}>Sign In</button>
              </div>
            )}
          </>
        )}
        {/* Fixed Theme Toggle - Desktop only */}
        <div className={cn("hidden lg:block fixed bottom-4 left-4 z-50", pinned ? "sidebar-pinned-fixed" : "")}> 
          <ThemeToggle />
        </div>
      </main>
    </div>
  );
}

// Main Page component with Suspense boundary
export default function Page() {
  return (
    <Suspense fallback={null}>
      <QueryEnhancerProvider>
        <PageContent />
      </QueryEnhancerProvider>
    </Suspense>
  );
}