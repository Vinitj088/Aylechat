'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Model, ModelType } from '../types'; // Adjust path if needed
import Header from './Header';
import Sidebar from './Sidebar';
import modelsData from '../../models.json'; // Adjust path
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AuthDialog } from '@/components/AuthDialog'; // Adjust path
import { toast } from 'sonner';
import { prefetchAll } from '../api/prefetch'; // Adjust path
import { useChat, type Message as UIMessage } from '@ai-sdk/react';
import dynamic from 'next/dynamic';

// Import UI components (original and prompt-kit)
import MobileSearchUI from './MobileSearchUI';
import DesktopSearchUI from './DesktopSearchUI';
import { ChatContainer } from '@/components/ui/chat-container';
import { Message } from '@/components/ui/message'; // prompt-kit Message
import { PromptInput, PromptInputTextarea } from '@/components/ui/prompt-input';
import { Loader } from '@/components/ui/loader';
import { ScrollButton } from '@/components/ui/scroll-button';
import ChatMessagesComponent from './ChatMessages'; // Original ChatMessages
import ChatInputComponent from './ChatInput'; // Original ChatInput

const DynamicSidebar = dynamic(() => import('./Sidebar'), {
  ssr: false
});

// Define props for ChatInterface
interface ChatInterfaceProps {
  id?: string; // Optional threadId from server component
  initialMessages?: UIMessage[]; // Optional initial messages from server component
}

// The main client component for chat interaction
export function ChatInterface({ id, initialMessages }: ChatInterfaceProps) {
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-2.0-flash');
  const [models, setModels] = useState<Model[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Use the passed-in ID prop for currentThreadId, allowing updates
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(id || null);
  const [refreshSidebar, setRefreshSidebar] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, isLoading: authLoading, openAuthDialog } = useAuth();
  const router = useRouter();
  // Get searchParams for client-side checks (like authRequired)
  const searchParams = useSearchParams();
  // Get params for client-side fallback (if not passed as prop)
  const params = useParams(); 

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = !!user;

  // Initialize useChat with props
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: handleSubmitFromHook,
    isLoading,
    error,
    setMessages,
    append,
    reload,
    stop,
  } = useChat({
    api: '/api/chat',
    // Use props for initial state
    initialMessages: initialMessages,
    id: currentThreadId ?? undefined, // Use state for dynamic ID updates
    sendExtraMessageFields: true,
    body: {
      model: selectedModel,
    },
    onError: (err) => { handleRequestError(err); },
  });

  // Effect to update currentThreadId if the id prop changes (e.g., navigation)
  // Also handles initial load if id is passed
  useEffect(() => {
     const currentIdFromUrl = Array.isArray(params?.threadId) ? params.threadId[0] : params?.threadId;
     const effectiveId = id ?? currentIdFromUrl ?? null;
     if (effectiveId !== currentThreadId) {
       console.log(`Setting current thread ID from prop/param: ${effectiveId}`);
       setCurrentThreadId(effectiveId);
       // Use setMessages to initialize or reset messages when ID changes
       setMessages(initialMessages || []); 
     }
   }, [id, params, currentThreadId, setMessages, initialMessages]); // Added dependencies


  // ... (Keep other effects: prefetch, auth dialog, load models, auth success, scroll) ...
   useEffect(() => { prefetchAll().catch(() => {}); }, []);
   useEffect(() => {
     const authRequired = searchParams.get('authRequired'); /* ... other checks ... */
     if (authRequired === 'true' /* ... */) { openAuthDialog(); /* ... */ }
     // ... toast logic ...
   }, [searchParams, openAuthDialog]);
   useEffect(() => {
     // Correct Exa model definition
     const exaModel: Model = {
        id: 'exa',
        name: 'Exa Search',
        provider: 'Exa',
        providerId: 'exa',
        enabled: true,
        toolCallType: 'native', // Or appropriate value
        searchMode: true
      };
     const baseModels = modelsData.models.filter(m => m.providerId !== 'exa');
     setModels([exaModel, ...baseModels]);
     const modelParam = searchParams.get('model'); if(modelParam) setSelectedModel(modelParam);
   }, [searchParams]);
   useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
   useEffect(() => {
     if (isAuthenticated) {
       setRefreshSidebar(prev => prev + 1);
     }
   }, [isAuthenticated]);


  // --- Handlers --- 
  const handleRequestError = async (error: Error) => {
    if (error.message.includes('401') || error.message.toLowerCase().includes('unauthorized')) openAuthDialog();
    else if (error.message.includes('Rate limit')) toast.error('RATE LIMIT', { /* ... */ });
    else toast.error('Error Processing Request', { description: error.message || 'Please try again' });
  };
  const handleModelChange = (modelId: string) => { setSelectedModel(modelId as ModelType); };
  const toggleSidebar = () => { setIsSidebarOpen(!isSidebarOpen); };

  // handleSubmit - Accept the event type expected by Search UI props
  const handleSubmit = (e?: React.FormEvent<Element>) => { // Use FormEvent<Element>
    if (e) e.preventDefault();
    const currentValue = input;
    if (!currentValue.trim() || isLoading) return;
    if (!isAuthenticated || !user) { openAuthDialog(); return; }
    
    // ALWAYS call the useChat hook's submit handler
    // Create the specific event type it expects
    const submitEvent = { 
        preventDefault: e?.preventDefault ?? (() => {}),
        // Add other needed properties from 'e' if necessary, casting if needed
        // Or just create the minimal event object
    } as React.FormEvent<HTMLFormElement>; 
    
    handleSubmitFromHook(submitEvent);
  };

  // Wrapper for ChatInput's onValueChange (string input)
  const handleInputValueChange = (newValue: string) => {
      const event = { target: { value: newValue } } as React.ChangeEvent<HTMLTextAreaElement>; 
      handleInputChange(event);
  };

  // Wrapper for ChatInput's onSubmit (no arguments)
  const handleInputSubmit = () => {
      // Call the main handler (which now *only* calls handleSubmitFromHook)
      handleSubmit(); 
  };

  // --- Image Gen Saving Logic (COMMENT OUT) --- 
  /*
  const saveImageGenerationThread = async (finalMessages: UIMessage[], userPrompt: string) => { ... };
  const createOrUpdateThread = async (threadContent: { messages: UIMessage[], title?: string }) => { ... };
  */
  // Simplified createOrUpdateThread if still needed elsewhere (e.g., future manual saves)
  const createOrUpdateThread = async (threadContent: { messages: UIMessage[], title?: string }) => { 
      console.warn("createOrUpdateThread called, but image gen flow is commented out.");
      return null; 
  }; 


  // --- New Chat Handler ---
  const handleNewChat = () => {
    setMessages([]);
    handleInputChange({ target: { value: '' } } as any);
    setCurrentThreadId(null);
    router.push('/'); // Navigate to base route for new chat
    stop();
  };

  // Keep Exa initial search logic (needs adjustment for props/state)
  useEffect(() => {
    if (messages.length === 0 && !isLoading && !initialMessages) { // Only run if no initial messages were passed
      const urlParams = new URLSearchParams(window.location.search);
      let searchQuery = urlParams.get('q');
      if (searchQuery) {
          // ... (existing Exa search logic using setMessages) ...
          console.log('TODO: Trigger Exa search for query:', searchQuery);
      }
    }
  }, [isLoading, messages.length, initialMessages, setMessages, handleInputChange]);


  // --- Render Logic --- 
  const hasMessages = messages.length > 0;
  const selectedModelObj = models.find(model => model.id === selectedModel);
  const isExa = selectedModel === 'exa';

  return (
    <main className="flex min-h-screen flex-col">
      <Header toggleSidebar={toggleSidebar} />
      <DynamicSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSignInClick={openAuthDialog}
        refreshTrigger={refreshSidebar}
        // Pass a handler to set thread ID *and* potentially fetch messages client-side if needed
        // Or rely on navigation triggering the server component route
      />

      {/* Keep conditional rendering based on messages */}
      {!hasMessages ? (
        <>
          <MobileSearchUI 
            input={input}
            // Pass the main handleSubmit wrapper
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            selectedModel={selectedModel}
            handleModelChange={handleModelChange}
            models={models}
            setInput={(value: string) => handleInputChange({ target: { value } } as any)}
            messages={messages} // Pass empty messages initially
            isExa={isExa}
            providerName={selectedModelObj?.provider || 'AI'} // Calculate provider name
          />
          <DesktopSearchUI 
             input={input}
             handleSubmit={handleSubmit}
             isLoading={isLoading}
             selectedModel={selectedModel}
             handleModelChange={handleModelChange}
             models={models}
             setInput={(value: string) => handleInputChange({ target: { value } } as any)}
             isExa={isExa}
             providerName={selectedModelObj?.provider || 'AI'}
             messages={messages}
          />
        </>
      ) : (
        // Use original ChatMessagesComponent and ChatInputComponent for now
        <>
          <ChatMessagesComponent 
            messages={messages}
            isLoading={isLoading}
            // Pass necessary props if ChatMessages was simplified
          />
          <ChatInputComponent 
            input={input}
            // Pass the correct input change handler expected by ChatInput
            handleInputChange={handleInputValueChange} // Pass wrapper
            // Pass the correct submit handler expected by ChatInput
            handleSubmit={handleInputSubmit} // Pass wrapper
            isLoading={isLoading}
            selectedModel={selectedModel}
            handleModelChange={handleModelChange}
            models={models}
            isExa={isExa}
            onNewChat={handleNewChat}
          />
        </>
        /* --- OR Use prompt-kit structure directly (alternative if SearchUIs removed) ---
        <ChatContainer ref={chatContainerRef} className="flex-1 flex flex-col py-4">
            <div className="flex-1 overflow-y-auto px-4 space-y-4">
                {messages.map(m => (<Message key={m.id} role={m.role}>{m.content}</Message>))}
                {isLoading && <div className="flex justify-center p-4"><Loader /></div>}
                <div ref={messagesEndRef} />
            </div>
            <ScrollButton scrollRef={messagesEndRef} containerRef={chatContainerRef} />
            <div className="px-4 py-2 border-t">
                <PromptInput ... /> 
            </div>
        </ChatContainer>
        */
      )}
    </main>
  );
} 