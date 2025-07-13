import React, { useRef, useEffect, useState } from 'react';
import { Model } from '../types';
import Markdown from 'markdown-to-jsx';
import ModelSelector from './ModelSelector';
import QueryEnhancer from './QueryEnhancer';
import { FileUp, X } from 'lucide-react';

// Import markdown options from MessageContent for consistent rendering
import { markdownOptions, processMarkdown } from './MessageContent';

// Add the parseMessageContent helper function
const parseMessageContent = (content: string) => {
  // If we find a complete think tag
  if (content.includes('</think>')) {
    const [thinking, ...rest] = content.split('</think>');
    return {
      thinking: thinking.replace('<think>', '').trim(),
      finalResponse: rest.join('</think>').trim(),
      isComplete: true
    };
  }
  // If we only find opening think tag, everything after it is thinking
  if (content.includes('<think>')) {
    return {
      thinking: content.replace('<think>', '').trim(),
      finalResponse: '',
      isComplete: false
    };
  }
  // No think tags, everything is final response
  return {
    thinking: '',
    finalResponse: content,
    isComplete: true
  };
};

interface MobileSearchUIProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement> | string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  selectedModel: string;
  handleModelChange: (modelId: string) => void;
  models: Model[];
  setInput: (value: string) => void;
  messages: { id: string; role: string; content: string }[];
  description: string;
  onAttachmentsChange?: (files: File[]) => void;
  isGuest: boolean;
  guestMessageCount: number;
  guestMessageLimit: number;
  openAuthDialog: () => void;
}

const MobileSearchUI: React.FC<MobileSearchUIProps> = ({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  selectedModel,
  handleModelChange,
  models,
  setInput,
  messages,
  description,
  onAttachmentsChange,
  isGuest,
  guestMessageCount,
  guestMessageLimit,
  openAuthDialog,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isRounded, setIsRounded] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("roundedCorners");
      setIsRounded(stored === "on");
    }
  }, []);

  const disableInput = isGuest && guestMessageCount >= guestMessageLimit;

  // Add file handling functions
  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Handle paste for images
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const newFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          newFiles.push(file);
        }
      }
    }

    if (newFiles.length > 0) {
      e.preventDefault(); // Prevent default paste behavior only if we found images
      const updatedAttachments = [...attachments, ...newFiles];
      setAttachments(updatedAttachments);
      onAttachmentsChange?.(updatedAttachments);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length > 0) {
      const updatedAttachments = [...attachments, ...newFiles];
      setAttachments(updatedAttachments);
      onAttachmentsChange?.(updatedAttachments);
    }
  };

  const isGeminiModel = selectedModel.startsWith('gemini');

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
        handleSubmit(e as unknown as React.FormEvent); // Submit on desktop
      } else {
        // If input is empty or loading is true on desktop, prevent submission but also prevent newline
        e.preventDefault();
      }
    }
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to get the correct scrollHeight
      textareaRef.current.style.height = 'auto';
      
      // Calculate new height
      const newHeight = textareaRef.current.scrollHeight;
      const maxHeight = 120; // Max height before scrolling (in pixels)
      
      if (newHeight > maxHeight) {
        // If content exceeds max height, set fixed height and enable scrolling
        textareaRef.current.style.height = `${maxHeight}px`;
        textareaRef.current.style.overflowY = 'auto';
      } else {
        // Otherwise, expand to fit content
        textareaRef.current.style.height = `${newHeight}px`;
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [input]);

  return (
    <div className="md:hidden min-h-screen bg-background pt-16 w-screen overflow-x-hidden">
      {/* Messages section */}
      {messages && messages.length > 0 && (
        <div className="w-full max-w-full mx-auto mb-8">
          <div className="space-y-6 p-4">
            {messages.filter(m => m.role !== 'system').map((message) => (
              <div key={message.id} className="w-full">
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-[var(--radius)] px-4 py-3 max-w-[85%] ${
                    message.role === 'user'
                      ? 'bg-secondary text-foreground message-human'
                      : 'bg-background border border-border rounded-[var(--radius)] text-foreground message-ai'
                  }`}>
                    {message.role === 'assistant' ? (
                      <>
                        {(() => {
                          const { thinking, finalResponse, isComplete } = parseMessageContent(message.content);
                          return (
                            <>
                              {(thinking || !isComplete) && (
                                <div className="my-6 space-y-3">
                                  <div className="flex items-center gap-2 text-foreground">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    <h3 className="text-sm font-medium">Thinking</h3>
                                  </div>
                                  <div className="pl-4 relative">
                                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border"></div>
                                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">{thinking}</div>
                                  </div>
                                </div>
                              )}
                              {isComplete && finalResponse && (
                                <div className="prose prose-sm max-w-none compact-prose dark:prose-invert overflow-hidden">
                                  <Markdown options={markdownOptions}>{processMarkdown(finalResponse)}</Markdown>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="whitespace-pre-wrap text-[15px]">{message.content}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="w-full max-w-full mx-auto p-4">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold mb-2 text-[var(--text-light-default)]">
            <span className="text-[var(--brand-default)]" style={{ fontFamily: 'var(--font-heading)' }}>The Web, </span> Organised
          </h1>
          <p className="text-sm text-[var(--text-light-muted)] mb-2">
            {description}
          </p>
        </div>
        
        {/* Search box */}
        <div className={`border ${isRounded ? 'border-2' : ''} border-[var(--brand-default)] rounded-lg bg-white dark:bg-[var(--secondary-darker)] shadow-sm overflow-hidden mb-6`}>
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--secondary-darkest)]">
              <svg className="w-5 h-5 text-[var(--text-light-muted)]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              
              <div className="w-full max-w-[200px]">
                <ModelSelector
                  selectedModel={selectedModel}
                  handleModelChange={handleModelChange}
                  models={models}
                />
              </div>
            </div>
            
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              autoFocus
              placeholder="Ask a question or search..."
              rows={1}
              className="w-full p-4 bg-white dark:bg-[var(--secondary-darker)] border-0 
              focus:outline-none focus:ring-0 text-base text-[var(--text-light-default)]
              placeholder:text-[var(--text-light-subtle)] resize-none min-h-[46px] max-h-[120px]
              scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent dark:focus:outline-none dark:focus:ring-0"
              style={{ lineHeight: '1.5' }}
              disabled={disableInput}
            />
            
            <div className="flex items-center justify-between px-2 py-2 border-t border-[var(--secondary-darkest)]">
              <div className="flex items-center gap-2">
                <QueryEnhancer input={input} setInput={setInput} isLoading={isLoading} isMobile={true} />
                {isGeminiModel && (
                  <button
                    type="button"
                    onClick={handleFileButtonClick}
                    disabled={isLoading}
                    className="p-2 text-[var(--text-light-muted)] hover:text-[var(--brand-default)] rounded-full hover:bg-[var(--secondary-faint)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              </div>
              
              <button
                type="submit"
                disabled={!input.trim() || isLoading || disableInput}
                className="bg-[var(--brand-default)] text-white px-4 py-2 rounded-md text-sm font-medium
                disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 dark:bg-[var(--brand-dark)] dark:hover:bg-[var(--brand-muted)]"
              >
                <div className="flex items-center justify-center gap-1">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{selectedModel === 'exa' ? 'SEARCH' : 'ASK'}</span>
                  </div>
              </button>
            </div>

            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="px-4 py-2 border-t border-[var(--secondary-darkest)] bg-[var(--secondary-faint)]">
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-white dark:bg-[var(--secondary-darker)] px-2 py-1 rounded-md text-sm"
                    >
                      <span className="truncate max-w-[150px]">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newAttachments = attachments.filter((_, i) => i !== index);
                          setAttachments(newAttachments);
                          onAttachmentsChange?.(newAttachments);
                        }}
                        className="text-[var(--text-light-muted)] hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
        
        {/* Popular searches for mobile */}
        <div className="mb-6">
          <h3 className="text-xs font-medium text-[var(--text-light-muted)] mb-3">TRY THESE</h3>
          <div className="grid grid-cols-1 gap-2">
            <button 
              onClick={() => setInput("Can you explain how black holes work?")}
              className="px-3 py-3 bg-white dark:bg-[var(--secondary-darker)] border border-[var(--secondary-darkest)] rounded-md text-sm hover:border-[var(--brand-default)] transition-colors text-left text-[var(--text-light-default)] transition-none"
            >
              Can you explain how black holes work?
            </button>
            <button 
              onClick={() => setInput("Can you tell me a fascinating story from history?")}
              className="px-3 py-3 bg-white dark:bg-[var(--secondary-darker)] border border-[var(--secondary-darkest)] rounded-md text-sm hover:border-[var(--brand-default)] transition-colors text-left text-[var(--text-light-default)] transition-none"
            >
              Can you tell me a fascinating story from history?
            </button>
            <button 
              onClick={() => setInput("Write a program to implement a binary search in c++?")}
              className="px-3 py-3 bg-white dark:bg-[var(--secondary-darker)] border border-[var(--secondary-darkest)] rounded-md text-sm hover:border-[var(--brand-default)] transition-colors text-left text-[var(--text-light-default)] transition-none"
            >
              Write a program to implement a binary search in c++?
            </button>
          </div>
        </div>
      </div>
      {disableInput && (
        <div className="flex flex-col items-center justify-center py-4">
          <p className="text-lg font-semibold mb-2">Sign in to continue chatting</p>
          <button className="px-4 py-2 bg-[var(--brand-default)] dark:bg-[var(--brand-fainter)] text-white rounded-md" onClick={openAuthDialog}>Sign In</button>
        </div>
      )}
    </div>
  );
};

export default MobileSearchUI; 