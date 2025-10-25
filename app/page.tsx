'use client';

import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Message, Model, ModelType, FileAttachment } from './types';
import Header from './component/Header';
import dynamic from 'next/dynamic';
import { ChatInputHandle } from './component/ChatInput';
import MobileSearchUI from './component/MobileSearchUI';
import DesktopSearchUI from './component/DesktopSearchUI';
import LeftSidebar from './component/LeftSidebar';
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
import useIsMobile from './hooks/useIsMobile';
import { QueryEnhancerProvider, useQueryEnhancer } from '@/context/QueryEnhancerContext';
import { db } from '@/lib/db';
import { id } from '@instantdb/react';
import { cn } from '@/lib/utils';

// Agentic imports
import { planComplexTask, executeTaskStep, TaskPlan, TaskStep } from './api/services/taskPlanner';
import TaskExecutionPanel from './component/TaskExecutionPanel';

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
    case 'perplexity':
      return 'Perplexity provides real-time search and web-aware AI responses.';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [sidebarMounted, setSidebarMounted] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
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
  const isMobile = useIsMobile();
  const { enhancerMode } = useQueryEnhancer();

  // Agentic state
  const [taskPlan, setTaskPlan] = useState<TaskPlan | null>(null);
  const [isExecutingPlan, setIsExecutingPlan] = useState(false);

  const isAuthenticated = !!user;

  // Set homepage document title
  useEffect(() => {
    document.title = 'Ayle';
  }, []);

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

  // Prefetch API modules and data when the app loads
  useEffect(() => {
    // Prefetch all API modules and data for faster initial response times
    prefetchAll().catch(() => {
      // Silently ignore prefetch errors as this is just an optimization
    });
  }, []);

  // Extract memories every 5 messages (Agentic feature)
  useEffect(() => {
    console.log(`💭 Message count: ${messages.length} | User: ${user ? user.id.substring(0, 8) : 'NOT LOGGED IN'} | Trigger: ${messages.length % 5 === 0 ? 'YES' : 'NO'}`);

    if (!user) {
      console.log('⚠️ Cannot extract memories: User not authenticated');
      return;
    }

    if (messages.length > 0 && messages.length % 5 === 0) {
      console.log(`🔄 Triggering memory extraction for ${messages.length} messages`);
      console.log('📤 Sending to /api/agent/extract-memories...');

      fetch('/api/agent/extract-memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, userId: user.id })
      })
      .then(res => res.json())
      .then(data => console.log('✅ Memory extraction response:', data))
      .catch(err => console.error('❌ Memory extraction error:', err));
    }
  }, [messages.length, user]);


  // Load models and set initially selected model
  useEffect(() => {
    // Load models from models.json and set initial model
    const groqModels = modelsData.models.filter(model => model.providerId === 'groq');
    const googleModels = modelsData.models.filter(model => model.providerId === 'google');
    const openRouterModels = modelsData.models.filter(model => model.providerId === 'openrouter');
    const cerebrasModels = modelsData.models.filter(model => model.providerId === 'cerebras');
    const xaiModels = modelsData.models.filter(model => model.providerId === 'xai');
    const togetherModels = modelsData.models.filter(model => model.providerId === 'together');
    const perplexityModels = modelsData.models.filter(model => model.providerId === 'perplexity');
    const inceptionModels = modelsData.models.filter(model => model.providerId === 'inception');
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
      ...perplexityModels,
      ...googleModels,
      ...cerebrasModels,
      ...inceptionModels,
      ...openRouterModels,
      ...groqModels,
      ...togetherModels
      
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

    // Only use the user's input as the message content; quotedText is shown in the custom UI, not as a blockquote
    const fullInput = input;

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

      // AGENTIC: Check if query needs multi-step task execution
      const complexTaskPlan = await planComplexTask(fullInput, messages);

      if (complexTaskPlan) {
        console.log('🤖 Complex task detected, creating autonomous plan:', complexTaskPlan);
        setIsExecutingPlan(true);
        setTaskPlan(complexTaskPlan);

        // Execute each step autonomously
        const stepResults = new Map<string, string>();

        for (let i = 0; i < complexTaskPlan.steps.length; i++) {
          const step = complexTaskPlan.steps[i];

          // Update step to in_progress
          complexTaskPlan.steps[i].status = 'in_progress';
          complexTaskPlan.currentStepIndex = i;
          setTaskPlan({ ...complexTaskPlan });

          try {
            // Execute step
            const result = await executeTaskStep(step, complexTaskPlan, stepResults);

            if (result.success) {
              complexTaskPlan.steps[i].status = 'completed';
              complexTaskPlan.steps[i].result = result.result;
              stepResults.set(step.id, result.result);

              // Add step result as assistant message
              const stepMessage: Message = {
                id: `step-${step.id}`,
                role: 'assistant',
                content: `**Step ${i + 1}/${complexTaskPlan.steps.length} Complete:** ${step.description}\n\n${result.result.substring(0, 500)}${result.result.length > 500 ? '...' : ''}`,
                createdAt: new Date(),
                completed: true,
              };

              setMessages(prev => [...prev, stepMessage]);
            } else {
              complexTaskPlan.steps[i].status = 'failed';
              complexTaskPlan.steps[i].error = result.error;
            }

            setTaskPlan({ ...complexTaskPlan });
          } catch (error) {
            complexTaskPlan.steps[i].status = 'failed';
            complexTaskPlan.steps[i].error = error instanceof Error ? error.message : 'Unknown error';
            setTaskPlan({ ...complexTaskPlan });
            break;
          }
        }

        // Mark plan as completed
        complexTaskPlan.status = complexTaskPlan.steps.every(s => s.status === 'completed') ? 'completed' : 'failed';
        setTaskPlan({ ...complexTaskPlan });
        setIsExecutingPlan(false);
        setIsLoading(false);

        // Final summary message
        const summaryMessage: Message = {
          id: `plan-complete-${Date.now()}`,
          role: 'assistant',
          content: `✅ **Multi-Step Task Complete!**\n\nSuccessfully executed ${complexTaskPlan.steps.filter(s => s.status === 'completed').length}/${complexTaskPlan.steps.length} steps autonomously.`,
          createdAt: new Date(),
          completed: true,
        };

        setMessages(prev => [...prev, summaryMessage]);

        // Store in database if we have a thread
        if (currentThreadId && user) {
          await db.transact([
            db.tx.messages.update(assistantMessage.id, {
              content: summaryMessage.content,
              completed: true,
            }),
          ]);
        }

        return; // Exit early, task execution complete
      }

      // Enrich query with memory if user is authenticated
      let finalQuery = fullInput;
      if (user) {
        console.log(`🔍 Attempting to enrich query: "${fullInput.substring(0, 50)}..."`);
        try {
          const response = await fetch('/api/agent/enrich-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: fullInput, userId: user.id })
          });

          if (response.ok) {
            const { enrichedQuery, memories } = await response.json();
            console.log(`📊 Found ${memories.length} memories for enrichment`);
            if (memories.length > 0) {
              finalQuery = enrichedQuery;
              console.log(`🧠 Enriched query with ${memories.length} relevant memories`);
              console.log('Memories:', memories.map(m => m.content));
            } else {
              console.log('ℹ️ No relevant memories found, using original query');
            }
          } else {
            console.log('⚠️ Enrichment API returned non-OK status:', response.status);
          }
        } catch (err) {
          console.error('❌ Query enrichment error:', err);
        }
      } else {
        console.log('⚠️ Skipping enrichment: User not authenticated');
      }

      // Regular text response flow - only execute this if not an image generation model
      // Capture the complete assistant message object from fetchResponse
      const completedAssistantMessage = await fetchResponse(
        finalQuery, // Use enriched query if available
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

  // Always sort messages by createdAt ascending before rendering
  const sortedMessages = [...messages].sort((a, b) => {
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

        {/* Desktop & Tablet Layout - Fixed sidebar */}
        <div className="hidden md:block min-h-screen">
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
            <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-full flex flex-col">
            {!hasMessages ? (
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
            ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              {/* Agentic: Task Execution Panel */}
              {taskPlan && (
                <div className="px-4 mb-4">
                  <TaskExecutionPanel
                    plan={taskPlan}
                    onCancel={() => {
                      setTaskPlan(null);
                      setIsExecutingPlan(false);
                    }}
                  />
                </div>
              )}

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
            </div>

            {/* Chat input: block for guest after 3 messages */}
            {(!isGuest || guestMessageCount < GUEST_MESSAGE_LIMIT) ? (
              hasMessages && (
                <div className="flex-shrink-0 w-full bg-[var(--secondary-default)] z-10">
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
                  />
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <p className="text-lg font-semibold mb-2 text-gray-300">Sign in to unlock unlimited messages and advanced features</p>
                <button className="px-4 py-2 text-sm font-medium text-white bg-[#C85D3F] hover:bg-[#d66b4d] rounded-lg transition-colors" onClick={openAuthDialog}>Sign In</button>
              </div>
            )}
              </>
            )}
            </div>
          </div>
        </div>

        {/* Mobile Content */}
        <div className="md:hidden h-screen flex flex-col relative pt-[60px]">
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

          {!hasMessages ? (
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
            <>
              <div className="flex-1 overflow-y-auto">
                {taskPlan && (
                  <div className="px-4 mb-4">
                    <TaskExecutionPanel
                      plan={taskPlan}
                      onCancel={() => {
                        setTaskPlan(null);
                        setIsExecutingPlan(false);
                      }}
                    />
                  </div>
                )}

                <ChatMessages
                  messages={sortedMessages}
                  isLoading={isLoading}
                  selectedModel={selectedModel}
                  selectedModelObj={selectedModelObj}
                  isExa={isExa}
                  currentThreadId={currentThreadId}
                />
              </div>

              <div className="flex-shrink-0 w-full bg-[var(--secondary-default)] z-10">
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
                />
              </div>

              {isGuest && guestMessageCount >= GUEST_MESSAGE_LIMIT && (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <p className="text-lg font-semibold mb-2 text-gray-300">Sign in to unlock unlimited messages and advanced features</p>
                  <button className="px-4 py-2 text-sm font-medium text-white bg-[#C85D3F] hover:bg-[#d66b4d] rounded-lg transition-colors" onClick={openAuthDialog}>Sign In</button>
                </div>
              )}
            </>
          )}
        </div>
    </>
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
