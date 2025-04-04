import React, { useRef, useEffect, useCallback } from 'react';
import { Model } from '../types';
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import { PromptInput as PromptKitInput, PromptInputTextarea, PromptInputActions, PromptInputAction } from '@/components/ui/prompt-input';
import ModelSelector from './ModelSelector';
import { Plus } from 'lucide-react';

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
  handleInputChange: (newValue: string) => void;
  handleSubmit: () => void;
  isLoading: boolean;
  selectedModel: string;
  handleModelChange: (modelId: string) => void;
  models: Model[];
  isExa: boolean;
  onNewChat?: () => void;
}

const ChatInput = ({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  selectedModel,
  handleModelChange,
  models,
  isExa,
  onNewChat
}: ChatInputProps) => {
  const lastModelRef = useRef<string>(selectedModel);

  const handleModelChangeWithPrefetch = useCallback((modelId: string) => {
    handleModelChange(modelId);
    prefetchAPI(modelId);
    lastModelRef.current = modelId;
  }, [handleModelChange]);

  useEffect(() => {
    if (selectedModel !== lastModelRef.current) {
      prefetchAPI(selectedModel);
      lastModelRef.current = selectedModel;
    }
  }, [selectedModel]);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[var(--secondary-faint)] border-t border-[var(--secondary-darkest)] z-40 w-screen overflow-x-hidden shadow-md">
      <div className="w-full max-w-full md:max-w-4xl mx-auto px-4 py-3 relative">
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
          {onNewChat && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewChat}
              className="text-[var(--text-light-muted)] hover:text-[var(--text-light-default)] hover:bg-[var(--secondary-darker)] group flex items-center gap-1 flex-shrink-0"
            >
              <Plus className="h-4 w-4 group-hover:text-[var(--brand-default)]" />
              <span className="font-medium">New chat</span>
            </Button>
          )}
        </div>

        <PromptKitInput
          isLoading={isLoading}
          value={input}
          onValueChange={handleInputChange}
          onSubmit={handleSubmit}
        >
          <PromptInputTextarea
            placeholder={isExa ? "Ask Exa..." : "Type your message..."}
            disabled={isLoading}
            autoFocus
            className="w-full p-3 resize-none min-h-[50px] max-h-[120px] 
            bg-white dark:bg-[var(--secondary-darker)] border-2 border-[var(--secondary-darkest)] rounded-md
            focus:outline-none focus:ring-1 focus:ring-[var(--brand-default)] focus:border-[var(--brand-default)]
            placeholder:text-[var(--text-light-subtle)] text-[var(--text-light-default)] font-medium shadow-sm dark:focus:ring-0 dark:focus:outline-none"
          />
        </PromptKitInput>
      </div>
    </div>
  );
};

ChatInput.displayName = 'ChatInput';

export default ChatInput; 