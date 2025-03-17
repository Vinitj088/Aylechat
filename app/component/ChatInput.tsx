import React, { useRef, useEffect } from 'react';
import Link from 'next/link';
import { Model } from '../types';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  selectedModel: string;
  handleModelChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  models: Model[];
  isExa: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  selectedModel,
  handleModelChange,
  models,
  isExa
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

  // Handle model selection from dropdown
  const handleModelSelect = (modelId: string) => {
    // Create a synthetic event object that mimics the onChange event from a select
    const syntheticEvent = {
      target: { value: modelId }
    } as React.ChangeEvent<HTMLSelectElement>;
    
    handleModelChange(syntheticEvent);
  };

  // Get the current model name for display
  const currentModelName = models.find(model => model.id === selectedModel)?.name || 'Select Model';

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t z-40 w-screen overflow-x-hidden">
      <div className="w-full max-w-full md:max-w-4xl mx-auto px-4 py-4 relative">
        <form onSubmit={handleSubmit} className="relative flex flex-col w-full">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <label htmlFor="chat-model-selector" className="text-sm text-gray-500 mr-2 hidden sm:inline">Model:</label>
              
              {/* Replace select with DropdownMenu */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none bg-white text-gray-800 font-medium">
                  <span className="max-w-[100px] sm:max-w-[150px] truncate">{currentModelName}</span>
                  <ChevronDown className="h-3 w-3 text-gray-500" />
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="start" 
                  className="w-56 max-h-[150px] overflow-y-auto bg-[#fffdf5] border border-gray-200"
                  sideOffset={5}
                >
                  <DropdownMenuLabel className="text-xs">Select Model</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {models.map((model) => (
                    <DropdownMenuItem 
                      key={model.id}
                      onClick={() => handleModelSelect(model.id)}
                      className={`text-sm py-1 ${selectedModel === model.id ? "bg-blue-50 text-blue-600" : ""}`}
                    >
                      {model.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">New chat</span>
              <Link
                href="/"
                className="text-blue-600 hover:text-blue-700"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
          </div>
          <div className="relative flex w-full">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              autoFocus
              placeholder="Ask something..."
              rows={1}
              className="w-full p-3 pr-[70px] bg-white border border-gray-200 rounded-sm shadow-sm 
              focus:outline-none focus:ring-1 focus:ring-[var(--brand-default)] focus:ring-opacity-20 
              focus:border-[var(--brand-default)] text-base transition-all duration-200 
              placeholder:text-gray-400 hover:border-gray-300 resize-none min-h-[46px] max-h-[120px]
              scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
              style={{ lineHeight: '1.5' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1 bg-[var(--brand-default)] 
              text-white rounded-md shadow-sm hover:bg-[var(--brand-muted)] disabled:opacity-50 
              disabled:cursor-not-allowed font-medium transition-all duration-200 
              hover:shadow-md active:transform active:scale-95"
            >
              {isExa ? 'Search' : 'Ask'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInput; 