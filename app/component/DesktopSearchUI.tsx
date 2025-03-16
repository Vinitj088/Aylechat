import React, { useRef, useEffect } from 'react';
import { Model } from '../types';

interface DesktopSearchUIProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  selectedModel: string;
  handleModelChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  models: Model[];
  autoprompt: boolean;
  toggleAutoprompt: () => void;
  setInput: (input: string) => void;
  isExa: boolean;
  providerName: string;
}

const DesktopSearchUI: React.FC<DesktopSearchUIProps> = ({
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
  isExa,
  providerName
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
    <div className="hidden md:flex min-h-screen flex-col items-center justify-center px-4 py-8 bg-[#fffdf5]">
      <div className="w-full max-w-3xl mx-auto mb-8 text-center">
        <h1 className="text-5xl font-bold mb-2">
          The web, <span className="text-blue-600">organized</span>
        </h1>
        <p className="text-lg text-gray-700 mb-4">
          {isExa ? 'Exa search uses embeddings to understand meaning.' : `${providerName} provides fast AI inference.`}
          {isExa && <span className="ml-1 underline">Learn more</span>}
        </p>
      </div>
      
      <div className="w-full max-w-3xl mx-auto">
        {/* Search toggles above the search box */}
        <div className="flex items-center justify-between mb-2 px-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <select
                id="desktop-model-selector"
                value={selectedModel}
                onChange={handleModelChange}
                className="text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Autoprompt</span>
            <button 
              type="button"
              onClick={toggleAutoprompt}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoprompt ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span 
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoprompt ? 'translate-x-6' : 'translate-x-1'}`} 
              />
            </button>
            <div className="relative group">
              <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 16V12M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Autoprompt helps refine your search query automatically
              </div>
            </div>
          </div>
        </div>
        
        {/* Search box */}
        <div className="border border-gray-200 rounded-lg bg-white p-2 shadow-sm">
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              autoFocus
              placeholder="Try a search or paste a link to find similar"
              rows={1}
              className="w-full p-4 pr-[130px] bg-white border-0 
              focus:outline-none focus:ring-0 text-base
              placeholder:text-gray-400 resize-none min-h-[46px] max-h-[120px]
              scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
              style={{ lineHeight: '1.5' }}
            />
            
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-blue-600
              text-white rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50
              disabled:cursor-not-allowed font-medium min-w-[110px] transition-all duration-200"
            >
              SEARCH
            </button>
          </form>
        </div>
        
        {/* Popular searches */}
        <div className="mt-8">
          <h3 className="text-sm font-medium text-gray-500 mb-3">POPULAR SEARCHES</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <button 
              onClick={() => setInput("a short article about the early days of Google")}
              className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm hover:border-gray-300 transition-colors text-left"
            >
              a short article about the early days of Google
            </button>
            <button 
              onClick={() => setInput("Start ups working on genetic sequencing")}
              className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm hover:border-gray-300 transition-colors text-left"
            >
              Start ups working on genetic sequencing
            </button>
            <button 
              onClick={() => setInput("Similar to https://waitbutwhy.com")}
              className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm hover:border-gray-300 transition-colors text-left"
            >
              Similar to https://waitbutwhy.com
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopSearchUI; 