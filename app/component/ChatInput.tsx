import React, { useRef, useEffect, useCallback } from 'react';
import { Model } from '../types';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import ModelSelector from './ModelSelector';

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

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  selectedModel: string;
  handleModelChange: (modelId: string) => void;
  models: Model[];
  isExa: boolean;
  onNewChat: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  selectedModel,
  handleModelChange,
  models,
  isExa,
  onNewChat
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastModelRef = useRef<string>(selectedModel);

  // Cache the model change handler with useCallback to prevent unnecessary recreations
  const handleModelChangeWithPrefetch = useCallback((modelId: string) => {
    // Call original handler
    handleModelChange(modelId);
    
    // Trigger API prefetch for the newly selected model
    prefetchAPI(modelId);
    
    // Update the last model reference
    lastModelRef.current = modelId;
  }, [handleModelChange]);

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

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.shiftKey && !isLoading && input.trim()) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[var(--secondary-faint)] border-t border-[var(--secondary-darkest)] z-40 w-screen overflow-x-hidden shadow-md">
      <div className="w-full max-w-full md:max-w-4xl mx-auto px-4 py-4 relative">
        <form onSubmit={handleSubmit} className="relative flex flex-col w-full">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center flex-shrink overflow-hidden max-w-[65%] sm:max-w-none">
              <label htmlFor="chat-model-selector" className="text-sm text-[var(--text-light-muted)] mr-2 hidden sm:inline font-medium">Model:</label>
              
              <div className="max-w-[160px] sm:max-w-[200px] md:max-w-none">
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
              className="text-[var(--text-light-muted)] hover:text-[var(--text-light-default)] hover:bg-[var(--secondary-darker)] group flex items-center gap-1 flex-shrink-0"
            >
              <Plus className="h-4 w-4 group-hover:text-[var(--brand-default)]" />
              <span className="font-medium">New chat</span>
            </Button>
          </div>
          <div className="relative flex w-full">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder={isExa ? "Search with Exa..." : "Ask a question..."}
              rows={1}
              className="w-full p-3 pr-[70px] resize-none min-h-[50px] max-h-[120px] 
              bg-white border-2 border-[var(--secondary-darkest)] rounded-md
              focus:outline-none focus:ring-1 focus:ring-[var(--brand-default)] focus:border-[var(--brand-default)]
              placeholder:text-[var(--text-light-subtle)] font-medium shadow-sm"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 
              bg-[var(--brand-default)] hover:bg-[var(--brand-muted)] text-white
              disabled:opacity-50 disabled:cursor-not-allowed font-medium
              rounded-md transition-all duration-200"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-1 text-[10px] text-[var(--text-light-muted)] text-center">
            Press <kbd className="px-1 py-0.5 bg-[var(--secondary-darker)] rounded text-[var(--text-light-default)] font-mono">Shift</kbd> + <kbd className="px-1 py-0.5 bg-[var(--secondary-darker)] rounded text-[var(--text-light-default)] font-mono">Enter</kbd> to send
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInput; 