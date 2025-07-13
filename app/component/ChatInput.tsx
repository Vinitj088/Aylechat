import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import { Model } from '../types';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Plus, FileUp, X, Paperclip, Film, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';
import ModelSelector from './ModelSelector';
import QueryEnhancer from './QueryEnhancer';
import { useQueryEnhancer } from '@/context/QueryEnhancerContext';
import { useSidebarPin } from '@/context/SidebarPinContext';

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Ensure window is defined (for SSR safety)
    if (typeof window === 'undefined') {
      return;
    }

    const checkDevice = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', checkDevice);
    checkDevice(); // Initial check on mount

    return () => {
      window.removeEventListener('resize', checkDevice);
    };
  }, []);

  return isMobile;
};

// Function to prefetch API endpoints
const prefetchAPI = async (modelId: string) => {
  // Determine which API endpoint to prefetch based on the model
  let apiEndpoint = '/api/groq'; // Default

  try {
    // Use a dynamic import to load the models.json file
    const modelsConfig = await import('../../models.json');
    // Find the model configuration
    const modelConfig = modelsConfig.models.find((m: any) => m.id === modelId);
    
    if (modelId === 'exa') {
      apiEndpoint = '/api/exaanswer';
    } else if (modelConfig?.toolCallType === 'openrouter') {
      apiEndpoint = '/api/openrouter';
    } else if (modelId.includes('gemini')) {
      apiEndpoint = '/api/gemini';
    }
    
    // Send a prefetch (warmup) request to the API
    fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        warmup: true,
        model: modelId
      }),
      // Use no-store to ensure this goes through and isn't cached
      cache: 'no-store'
    }).catch(() => {
      // Silently ignore errors in prefetch
    });
  } catch (e) {
    // Silently ignore any errors during prefetching
  }
};

export interface ChatInputHandle {
  focus: () => void;
}

// Attachment type interface
interface Attachment {
  file: File;
  previewUrl?: string; // For image files
}

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement> | string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  selectedModel: string;
  handleModelChange: (modelId: string) => void;
  models: Model[];
  isExa: boolean;
  onNewChat: () => void;
  onAttachmentsChange?: (files: File[]) => void;
  activeChatFiles?: Array<{ name: string; type: string; uri: string }>;
  removeActiveFile?: (uri: string) => void;
  onActiveFilesHeightChange?: (height: number) => void;
  quotedText?: string;
  setQuotedText?: (text: string) => void;
  sidebarPinned?: boolean;
}

// Define command mode state type
type CommandMode = 'none' | 'movies' | 'tv';

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  selectedModel,
  handleModelChange,
  models,
  isExa,
  onNewChat,
  onAttachmentsChange,
  activeChatFiles,
  removeActiveFile,
  onActiveFilesHeightChange,
  quotedText,
  setQuotedText,
  sidebarPinned = false
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastModelRef = useRef<string>(selectedModel);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const activeFilesContainerRef = useRef<HTMLDivElement>(null);
  const { enhancerMode } = useQueryEnhancer();
  const isMobile = useIsMobile();
  // State for command mode
  const [commandMode, setCommandMode] = useState<CommandMode>('none');

  // Check if current model is a Gemini model
  const isGeminiModel = selectedModel.includes('gemini');

  const { pinned } = useSidebarPin()

  // Expose the focus method to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    }
  }));

  // Cache the model change handler with useCallback to prevent unnecessary recreations
  const handleModelChangeWithPrefetch = useCallback((modelId: string) => {
    // Call original handler
    handleModelChange(modelId);
    
    // Trigger API prefetch for the newly selected model
    prefetchAPI(modelId);
    
    // Clear attachments if switching to a non-Gemini model
    if (!modelId.includes('gemini') && attachments.length > 0) {
      setAttachments([]);
    }
    
    // Update the last model reference
    lastModelRef.current = modelId;
  }, [handleModelChange, attachments]);

  // Open the file browser
  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Update parent component when attachments change
  useEffect(() => {
    if (onAttachmentsChange) {
      // Convert Attachment[] to File[]
      const files = attachments.map(attachment => attachment.file);
      onAttachmentsChange(files);
    }
  }, [attachments, onAttachmentsChange]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];
    
    Array.from(files).forEach(file => {
      // Create preview URL for images
      let previewUrl: string | undefined;
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      }
      
      newAttachments.push({ file, previewUrl });
    });

    const updatedAttachments = [...attachments, ...newAttachments];
    setAttachments(updatedAttachments);
    
    // Reset the file input value so the same file can be selected again
    e.target.value = '';
  };

  // Remove an attachment by index
  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const updated = [...prev];
      // Revoke object URL if it exists to prevent memory leaks
      if (updated[index].previewUrl) {
        URL.revokeObjectURL(updated[index].previewUrl);
      }
      updated.splice(index, 1);
      return updated;
    });
  };

  // --- Modify handleInputChange to detect commands --- 
  const handleInputChangeWithCommandDetection = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    handleInputChange(e); // Call original handler

    if (value.startsWith('/movies ')) {
      setCommandMode('movies');
    } else if (value.startsWith('/tv ')) {
      setCommandMode('tv');
    } else {
      setCommandMode('none');
    }
  }, [handleInputChange]);
  // --- End Modify --- 

  // Modified submit handler to include attachments and quote
  const handleSubmitWithAttachments = (e: React.FormEvent) => {
    e.preventDefault();
    // Extract files from attachments
    const files = attachments.map(att => att.file);
    // Notify parent component about attachments if the callback exists
    if (onAttachmentsChange) {
      onAttachmentsChange(files);
    }
    // If there's a quote, prepend it as markdown to the input
    if (quotedText && quotedText.trim().length > 0) {
      // Call handleInputChange with the quoted text prepended
      handleInputChange(`> ${quotedText.replace(/\n/g, '\n> ')}\n\n${input}`);
      if (setQuotedText) setQuotedText('');
      // Call the original handleSubmit after updating input
      setTimeout(() => handleSubmit(e), 0);
    } else {
      handleSubmit(e);
    }
    // Clear attachments after submit
    attachments.forEach(attachment => {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    });
    setAttachments([]);
    // Reset command mode on submit
    setCommandMode('none');
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = textareaRef.current.scrollHeight;
      const maxHeight = 120;
      
      if (newHeight > maxHeight) {
        textareaRef.current.style.height = `${maxHeight}px`;
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.height = `${newHeight}px`;
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [input]);

  // Prefetch API when component mounts or when model changes
  useEffect(() => {
    // Only prefetch if the model has changed
    if (selectedModel !== lastModelRef.current) {
      prefetchAPI(selectedModel);
      lastModelRef.current = selectedModel;
    }
  }, [selectedModel]);

  // Clean up attachment preview URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach(attachment => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, [attachments]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Check for mobile using touch events
    // Adding navigator.maxTouchPoints > 0 for wider compatibility
    // Added typeof window check for SSR safety
    const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

    // If Shift + Enter is pressed, let the default behavior (newline) happen
    if (e.key === 'Enter' && e.shiftKey) {
      return; // Allow newline
    }

    // If Enter is pressed (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      // If it's a mobile device, let the default behavior (newline) happen
      if (isMobile) {
        return; // Allow newline on mobile
      }

      // If it's NOT mobile (desktop) and conditions are met, submit the form
      if (!isLoading && input.trim()) {
        e.preventDefault(); // Prevent newline on desktop
        handleSubmitWithAttachments(e as unknown as React.FormEvent); // Submit on desktop
        // Reset command mode on submit via Enter key
        setCommandMode('none');
      } else {
        // If input is empty or loading is true on desktop, prevent submission but also prevent newline
        e.preventDefault();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const newAttachments: Attachment[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const previewUrl = URL.createObjectURL(file);
          newAttachments.push({ file, previewUrl });
        }
      }
    }

    if (newAttachments.length > 0) {
      e.preventDefault(); // Prevent default paste behavior only if we found images
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  // Step 1: Effect to measure active files height
  useEffect(() => {
    let height = 0;
    if (activeFilesContainerRef.current) {
      height = activeFilesContainerRef.current.clientHeight;
    }
    // console.log('Active files container height:', height); // Debug log
    onActiveFilesHeightChange?.(height);
  }, [activeChatFiles, onActiveFilesHeightChange]);

  // --- Determine dynamic placeholder --- 
  const getPlaceholder = () => {
    if (isExa) return "Press / to search with Exa...";
    switch (commandMode) {
      case 'movies': return 'Search for movies...';
      case 'tv': return 'Search for TV shows...';
      default: return "Press / to ask a question...";
    }
  };
  // --- End Determine --- 

  // Helper to truncate quoted text for display
  const getTruncatedQuote = (text: string) => {
    if (!text) return '';
    const words = text.split(/\s+/);
    if (words.length > 100) {
      return words.slice(0, 100).join(' ') + ' ...';
    }
    return text;
  };

  return (
       <div className="sticky bottom-0 w-full max-w-4xl mx-auto bg-background border border-border rounded-t-[var(--radius)] shadow-lg p-3 z-50 scrollbar-none">
          {/* Step 6: Display Active Files - MOVED TO TOP */}
          {activeChatFiles && activeChatFiles.length > 0 && removeActiveFile && (
            <div
              ref={activeFilesContainerRef}
              className="mb-2 flex gap-2 items-center border-b border-border pb-2 pt-1 overflow-x-auto whitespace-nowrap scrollbar-none"
            >
              <span className="text-xs font-medium text-muted-foreground mr-1 flex-shrink-0">Active:</span>
              {activeChatFiles.map((file) => (
                <div
                  key={file.uri}
                  className="flex items-center gap-1.5 bg-accent/10 text-accent-foreground text-xs px-2 py-1 rounded-[var(--radius)]"
                  title={`${file.name} (${file.type}) - Referenced for follow-up questions`}
                >
                  <Paperclip className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeActiveFile(file.uri)}
                    className="ml-1 p-0.5 rounded-[var(--radius)] hover:bg-accent/20 text-accent-foreground"
                    aria-label="Stop referencing this file"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Attachments Preview - MOVED TO TOP */}
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2 border-b border-border pb-2">
              {attachments.map((attachment, index) => (
                <div key={index} className="relative group">
                  {attachment.previewUrl ? (
                    <div className="relative w-16 h-16 rounded-[var(--radius)] overflow-hidden border border-border">
                      <img
                        src={attachment.previewUrl}
                        alt={`Attachment ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="absolute top-1 right-1 z-10 bg-muted text-primary-foreground rounded-[var(--radius)] p-0.5 opacity-90 hover:opacity-100 shadow-md border border-border"
                        aria-label="Remove attachment"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative flex items-center justify-center w-16 h-16 bg-secondary rounded-[var(--radius)] border border-border">
                      <span className="text-xs text-center overflow-hidden text-ellipsis px-1">
                        {attachment.file.name.length > 12
                          ? `${attachment.file.name.substring(0, 6)}...${attachment.file.name.substring(attachment.file.name.length - 3)}`
                          : attachment.file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="absolute -top-1 -right-1 bg-muted text-primary-foreground rounded-[var(--radius)] p-0.5 opacity-80 hover:opacity-100"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmitWithAttachments} className="relative flex flex-col w-full">
            {/* Quote block UI */}
            {quotedText && quotedText.trim().length > 0 && (
              <div className="flex items-start bg-muted border-l-4 border-primary rounded-[var(--radius)] p-3 mb-2 relative">
                <span className="text-muted-foreground text-sm flex-1 whitespace-pre-line">{getTruncatedQuote(quotedText)}</span>
                {setQuotedText && (
                  <button
                    type="button"
                    className="ml-2 text-muted-foreground hover:text-foreground absolute top-2 right-2"
                    onClick={() => setQuotedText('')}
                    aria-label="Remove quote"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center flex-shrink overflow-hidden max-w-[65%] sm:max-w-none">
                  <label htmlFor="chat-model-selector" className="text-sm text-muted-foreground mr-2 hidden sm:inline font-medium">Model:</label>
                
                <div className="max-w-[160px] sm:max-w-[200px] md:max-w-none ">
                  <ModelSelector
                    selectedModel={selectedModel}
                    handleModelChange={handleModelChangeWithPrefetch}
                    models={models}
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNewChat}
                                  className="text-muted-foreground hover:text-foreground hover:bg-accent group flex items-center gap-1 flex-shrink-0 transition-all duration-200 ease-in-out transform hover:scale-105 focus:scale-105"
              >
                <Plus className="h-4 w-4 group-hover:text-primary transition-transform duration-200 ease-in-out group-hover:rotate-90" />
                <span className="font-medium">New chat</span>
              </Button>
            </div>
            
            <div className="relative flex w-full">
              {/* Conditionally render command icon */} 
              {commandMode === 'movies' && (
                <Film className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              )}
              {commandMode === 'tv' && (
                <Tv className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              )}
              
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChangeWithCommandDetection}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                autoFocus
                placeholder={getPlaceholder()}
                rows={1}
                className={cn(
                  "w-full p-3 resize-none min-h-[50px] max-h-[120px]",
                  "bg-accent border-2 border-border rounded-[var(--radius)]",
                  "focus:outline-none focus:ring-1 focus:ring-ring focus:border-primary",
                  "placeholder:text-muted-foreground text-foreground font-medium shadow-sm dark:focus:ring-0 dark:focus:outline-none",
                  commandMode !== 'none' ? "pl-9" : "pl-3",
                  enhancerMode === 'manual' 
                    ? (isMobile ? 'pr-[95px]' : 'pr-[140px]') 
                    : 'pr-[90px]',
                  "scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]"
                )}
                disabled={isLoading}
              />
              
              <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
                {isGeminiModel && (
                  <button
                    type="button"
                    onClick={handleFileButtonClick}
                    disabled={isLoading}
                    className="p-2 text-muted-foreground hover:text-primary rounded-[var(--radius)] hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileUp className="h-4 w-4" />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      multiple
                    />
                  </button>
                )}
                
                <QueryEnhancer 
                  input={input} 
                  setInput={(value: string) => handleInputChange(value)} 
                  isLoading={isLoading} 
                  isMobile={isMobile}
                />

                <Button
                  type="submit"
                  size="icon"
                  disabled={(!input.trim() && attachments.length === 0) || isLoading}
                  className="h-9 w-9 flex-shrink-0
                  bg-primary hover:bg-primary/90 text-primary-foreground
                  disabled:opacity-50 disabled:cursor-not-allowed font-medium
                  rounded-[var(--radius)] transition-all duration-200"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground text-center">
              Press <kbd className="px-1 py-0.5 bg-secondary rounded-[var(--radius)] text-foreground font-mono">Shift</kbd> + <kbd className="px-1 py-0.5 bg-secondary rounded-[var(--radius)] text-foreground font-mono">Enter</kbd> for new line
            </div>
          </form>
        </div>
 
  );
});

export default ChatInput;