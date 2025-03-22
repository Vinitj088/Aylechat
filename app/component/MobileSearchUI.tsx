import React, { useRef, useEffect } from 'react';
import { Model } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
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
    <div className="md:hidden min-h-screen bg-[#fffdf5] pt-16 w-screen overflow-x-hidden">
      {/* Messages section */}
      {messages && messages.length > 0 && (
        <div className="w-full max-w-full mx-auto px-4 mb-8">
          <div className="space-y-6">
            {messages.filter(m => m.role !== 'system').map((message) => (
              <div key={message.id} className="w-full">
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded px-4 py-3 max-w-[85%] ${
                    message.role === 'user'
                      ? 'bg-[var(--secondary-darker)] text-black'
                      : 'text-gray-900'
                  }`}>
                    {message.role === 'assistant' ? (
                      <>
                        {(() => {
                          const { thinking, finalResponse, isComplete } = parseMessageContent(message.content);
                          return (
                            <>
                              {(thinking || !isComplete) && (
                                <div className="my-6 space-y-3">
                                  <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    <h3 className="text-sm font-medium">Thinking</h3>
                                  </div>
                                  <div className="pl-4 relative">
                                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                                    <div className="text-sm text-gray-600 whitespace-pre-wrap">{thinking}</div>
                                  </div>
                                </div>
                              )}
                              {isComplete && finalResponse && (
                                <div className="prose prose-sm max-w-none compact-prose">
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

      <div className="w-full max-w-full mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">
            The web, <span className="text-blue-600">organized</span>
          </h1>
          <p className="text-base text-gray-700 mb-2">
            {isExa ? 'Exa search uses embeddings to understand meaning.' : `${providerName} provides fast AI inference.`}
          </p>
          {isExa && (
            <p className="text-base text-gray-700 underline">
              Learn more
            </p>
          )}
        </div>
        
        {/* Search box */}
        <div className="border border-blue-600 rounded-lg bg-white shadow-sm overflow-hidden mb-8">
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              autoFocus
              placeholder="Try a search or paste a link to find similar"
              rows={1}
              className="w-full p-4 bg-white border-0 
              focus:outline-none focus:ring-0 text-base
              placeholder:text-gray-400 resize-none min-h-[46px] max-h-[120px]
              scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
              style={{ lineHeight: '1.5' }}
            />
            
            <div className="border-t border-gray-200 px-4 py-2">
              <div className="flex items-center gap-1 mb-2 mt-2">
                <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                
                <div className="w-full max-w-[160px]">
                  <ModelSelector
                    selectedModel={selectedModel}
                    handleModelChange={handleModelChange}
                    models={models}
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={toggleAutoprompt}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoprompt ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <span 
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoprompt ? 'translate-x-6' : 'translate-x-1'}`} 
                  />
                </button>
                <span className="text-sm text-gray-500">Autoprompt</span>
                <div className="relative group">
                  <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 16V12M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-full bg-blue-600 text-white py-3 font-medium
              disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4L12 12M12 12L20 4M12 12L4 20M12 12L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>SEARCH</span>
              </div>
            </button>
          </form>
        </div>
        
        {/* Popular searches */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-500 mb-3">POPULAR SEARCHES</h3>
          <div className="space-y-2">
            <button 
              onClick={() => setInput("a short article about the early days of Google")}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm hover:border-gray-300 transition-colors text-left"
            >
              a short article about the early days of Google
            </button>
            <button 
              onClick={() => setInput("Start ups working on genetic sequencing")}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm hover:border-gray-300 transition-colors text-left"
            >
              Start ups working on genetic sequencing
            </button>
            <button 
              onClick={() => setInput("Similar to https://waitbutwhy.com")}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm hover:border-gray-300 transition-colors text-left"
            >
              Similar to https://waitbutwhy.com
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileSearchUI; 