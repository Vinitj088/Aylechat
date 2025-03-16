import React, { useRef, useEffect, useState } from 'react';
import { Model } from '../types';
import { useSession } from 'next-auth/react';
import { AuthDialog } from './AuthDialog';

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
  const { data: session } = useSession();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      setShowAuthDialog(true);
      return;
    }
    handleSubmit(e);
  };

  const handleLocalInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!session) {
      setShowAuthDialog(true);
      return;
    }
    handleInputChange(e);
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 relative">
          <form onSubmit={handleFormSubmit} className="relative flex flex-col w-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <label htmlFor="chat-model-selector" className="text-sm text-gray-500 mr-2">Model:</label>
                <select
                  id="chat-model-selector"
                  value={selectedModel}
                  onChange={handleModelChange}
                  disabled={!session}
                  className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--brand-default)] max-w-[120px] sm:max-w-[180px] truncate bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">New chat</span>
                <a
                  href="/"
                  className="text-blue-600 hover:text-blue-700"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              </div>
            </div>
            <div className="relative flex w-full">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleLocalInputChange}
                onClick={() => !session && setShowAuthDialog(true)}
                autoFocus
                placeholder={session ? "Ask something..." : "Sign in to start chatting..."}
                rows={1}
                disabled={!session}
                className={`w-full p-3 pr-[70px] bg-white border border-gray-200 rounded-sm shadow-sm 
                focus:outline-none focus:ring-1 focus:ring-[var(--brand-default)] focus:ring-opacity-20 
                focus:border-[var(--brand-default)] text-base transition-all duration-200 
                placeholder:text-gray-400 hover:border-gray-300 resize-none min-h-[46px] max-h-[120px]
                scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent
                ${!session ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                style={{ lineHeight: '1.5' }}
              />
              <button
                type="submit"
                disabled={!session || !input.trim() || isLoading}
                onClick={() => !session && setShowAuthDialog(true)}
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

      <AuthDialog 
        isOpen={showAuthDialog} 
        onClose={() => setShowAuthDialog(false)}
        onSuccess={() => setShowAuthDialog(false)}
      />
    </>
  );
};

export default ChatInput; 