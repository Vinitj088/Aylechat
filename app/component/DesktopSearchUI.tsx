import React, { useRef, useEffect } from 'react';
import { Model } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ModelSelector from './ModelSelector';
import QueryEnhancer from './QueryEnhancer';

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

interface DesktopSearchUIProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  selectedModel: string;
  handleModelChange: (modelId: string) => void;
  models: Model[];
  setInput: (input: string) => void;
  isExa?: boolean;
  providerName?: string;
  messages: { id: string; role: string; content: string }[];
}

const DesktopSearchUI: React.FC<DesktopSearchUIProps> = ({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  selectedModel,
  handleModelChange,
  models,
  setInput,
  isExa,
  providerName,
  messages
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading && input.trim()) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
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
    <div className="hidden md:flex min-h-screen flex-col items-center justify-center px-4 py-8 bg-[var(--secondary-faint)] w-screen overflow-x-hidden">
      {/* Messages section */}
      {messages && messages.length > 0 && (
        <div className="w-full max-w-full md:max-w-3xl mx-auto mb-8">
          <div className="space-y-6">
            {messages.filter(m => m.role !== 'system').map((message) => (
              <div key={message.id} className="w-full">
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded px-4 py-3 max-w-[85%] ${
                    message.role === 'user'
                      ? 'bg-[var(--secondary-darker)] text-[var(--text-light-default)] message-human'
                      : 'text-[var(--text-light-default)] message-ai'
                  }`}>
                    {message.role === 'assistant' ? (
                      <>
                        {(() => {
                          const { thinking, finalResponse, isComplete } = parseMessageContent(message.content);
                          return (
                            <>
                              {(thinking || !isComplete) && (
                                <div className="my-6 space-y-3">
                                  <div className="flex items-center gap-2 text-[var(--text-light-default)]">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    <h3 className="text-sm font-medium">Thinking</h3>
                                  </div>
                                  <div className="pl-4 relative">
                                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--secondary-darkest)]"></div>
                                    <div className="text-sm text-[var(--text-light-muted)] whitespace-pre-wrap">{thinking}</div>
                                  </div>
                                </div>
                              )}
                              {isComplete && finalResponse && (
                                <div className="prose prose-sm max-w-none compact-prose dark:prose-invert">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{finalResponse}</ReactMarkdown>
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

      <div className="w-full max-w-full md:max-w-3xl mx-auto mb-8 text-center">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold mb-2 text-[var(--text-light-default)]">
            The web, <span className="text-[var(--brand-default)]" style={{ fontFamily: 'Space Grotesk' }}>organized</span>
          </h1>
          <p className="text-base text-[var(--text-light-muted)] mb-2">
            {isExa ? 'Exa search uses embeddings to understand meaning.' : `${providerName} provides fast AI inference.`}
          </p>
          {isExa && (
            <p className="text-base text-[var(--text-light-muted)] underline">
              Learn more
            </p>
          )}
        </div>
        
        {/* Search box */}
        <div className="border border-[var(--brand-default)] rounded-lg bg-white dark:bg-[var(--secondary-darker)] shadow-sm overflow-hidden mb-8">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--secondary-darkest)]">
              <svg className="w-5 h-5 text-[var(--text-light-muted)]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              
              <div className="w-full max-w-[180px]">
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
              autoFocus
              placeholder="Try a search or paste a link to find similar"
              rows={1}
              className="w-full p-4 bg-white dark:bg-[var(--secondary-darker)] border-0 
              focus:outline-none focus:ring-0 text-base text-[var(--text-light-default)]
              placeholder:text-[var(--text-light-subtle)] resize-none min-h-[46px] max-h-[120px]
              scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent dark:focus:outline-none"
              style={{ lineHeight: '1.5' }}
            />
            
            <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--secondary-darkest)]">
              <div className="flex items-center gap-2">
                <QueryEnhancer input={input} setInput={setInput} isLoading={isLoading} />
                <span className="text-sm text-[var(--text-light-muted)]">Enhance Query</span>
              </div>
              
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="bg-[var(--brand-default)] text-white px-6 py-2 rounded-md font-medium
                disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 dark:bg-[var(--brand-dark)] dark:hover:bg-[var(--brand-muted)]"
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4L12 12M12 12L20 4M12 12L4 20M12 12L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span>SEARCH</span>
                </div>
              </button>
            </div>
          </form>
        </div>
        
        {/* Popular searches */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-[var(--text-light-muted)] mb-3">POPULAR SEARCHES</h3>
          <div className="grid grid-cols-3 gap-3">
            <button 
              onClick={() => setInput("Can you explain how black holes work?")}
              className="px-3 py-2 bg-white dark:bg-[var(--secondary-darker)] border border-[var(--secondary-darkest)] rounded-md text-sm hover:border-[var(--brand-default)] transition-colors text-left text-[var(--text-light-default)]"
            >
              Can you explain how black holes work?
            </button>
            <button 
              onClick={() => setInput("Can you tell me a fascinating story from history?")}
              className="px-3 py-2 bg-white dark:bg-[var(--secondary-darker)] border border-[var(--secondary-darkest)] rounded-md text-sm hover:border-[var(--brand-default)] transition-colors text-left text-[var(--text-light-default)]"
            >
              Can you tell me a fascinating story from history?
            </button>
            <button 
              onClick={() => setInput("Write a program to implement a binary search in c++?")}
              className="px-3 py-2 bg-white dark:bg-[var(--secondary-darker)] border border-[var(--secondary-darkest)] rounded-md text-sm hover:border-[var(--brand-default)] transition-colors text-left text-[var(--text-light-default)]"
            >
              Write a program to implement a binary search in c++?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopSearchUI; 