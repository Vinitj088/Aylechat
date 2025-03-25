import React, { useRef, useEffect } from 'react';
import { Model } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ModelSelector from './ModelSelector';

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
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  selectedModel: string;
  handleModelChange: (modelId: string) => void;
  models: Model[];
  autoprompt: boolean;
  toggleAutoprompt: () => void;
  setInput: (input: string) => void;
  messages: { id: string; role: string; content: string }[];
  isExa?: boolean;
  providerName?: string;
}

const MobileSearchUI: React.FC<MobileSearchUIProps> = ({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  selectedModel,
  handleModelChange,
  models,
  autoprompt,
  toggleAutoprompt,
  setInput,
  messages,
  isExa = true,
  providerName = ''
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="md:hidden min-h-screen bg-[var(--secondary-faint)] pt-16 w-screen overflow-x-hidden">
      {/* Messages section */}
      {messages && messages.length > 0 && (
        <div className="w-full max-w-full mx-auto mb-8">
          <div className="space-y-6 p-4">
            {messages.filter(m => m.role !== 'system').map((message) => (
              <div key={message.id} className="w-full">
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded px-4 py-3 max-w-[85%] ${
                    message.role === 'user'
                      ? 'bg-[var(--secondary-darker)] text-[var(--text-light-default)] message-human'
                      : 'bg-white dark:bg-[var(--secondary-faint)] border border-[var(--secondary-darkest)] rounded-lg text-[var(--text-light-default)] message-ai'
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

      <div className="w-full max-w-full mx-auto p-4">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold mb-2 text-[var(--text-light-default)]">
            <span className="text-[var(--brand-default)]" style={{ fontFamily: 'Space Grotesk' }}>The Web, </span> Organised
          </h1>
          <p className="text-sm text-[var(--text-light-muted)] mb-2">
            {isExa ? 'Exa search uses embeddings to understand meaning.' : `${providerName} provides fast AI inference.`}
          </p>
        </div>
        
        {/* Search box */}
        <div className="border border-[var(--brand-default)] rounded-lg bg-white dark:bg-[var(--secondary-darker)] shadow-sm overflow-hidden mb-6">
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
              autoFocus
              placeholder="Ask a question or search..."
              rows={1}
              className="w-full p-4 bg-white dark:bg-[var(--secondary-darker)] border-0 
              focus:outline-none focus:ring-0 text-base text-[var(--text-light-default)]
              placeholder:text-[var(--text-light-subtle)] resize-none min-h-[46px] max-h-[120px]
              scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent dark:focus:outline-none dark:focus:ring-0"
              style={{ lineHeight: '1.5' }}
            />
            
            <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--secondary-darkest)]">
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={toggleAutoprompt}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoprompt ? 'bg-[var(--brand-default)]' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <span 
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoprompt ? 'translate-x-6' : 'translate-x-1'}`} 
                  />
                </button>
                <span className="text-xs text-[var(--text-light-muted)]">Autoprompt</span>
              </div>
              
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="bg-[var(--brand-default)] text-white px-4 py-2 rounded-md text-sm font-medium
                disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <div className="flex items-center justify-center gap-1">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4L12 12M12 12L20 4M12 12L4 20M12 12L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span>SEARCH</span>
                </div>
              </button>
            </div>
          </form>
        </div>
        
        {/* Popular searches for mobile */}
        <div className="mb-6">
          <h3 className="text-xs font-medium text-[var(--text-light-muted)] mb-3">TRY THESE</h3>
          <div className="grid grid-cols-1 gap-2">
            <button 
              onClick={() => setInput("Can you explain how black holes work?")}
              className="px-3 py-3 bg-white dark:bg-[var(--secondary-darker)] border border-[var(--secondary-darkest)] rounded-md text-sm hover:border-[var(--brand-default)] transition-colors text-left text-[var(--text-light-default)]"
            >
              Can you explain how black holes work?
            </button>
            <button 
              onClick={() => setInput("Can you tell me a fascinating story from history?")}
              className="px-3 py-3 bg-white dark:bg-[var(--secondary-darker)] border border-[var(--secondary-darkest)] rounded-md text-sm hover:border-[var(--brand-default)] transition-colors text-left text-[var(--text-light-default)]"
            >
              Can you tell me a fascinating story from history?
            </button>
            <button 
              onClick={() => setInput("Write a program to implement a binary search in c++?")}
              className="px-3 py-3 bg-white dark:bg-[var(--secondary-darker)] border border-[var(--secondary-darkest)] rounded-md text-sm hover:border-[var(--brand-default)] transition-colors text-left text-[var(--text-light-default)]"
            >
              Write a program to implement a binary search in c++?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileSearchUI; 