import React, { useRef, useEffect, useState } from 'react';
import { Model } from '../types';
import { ArrowUp, X, Check, Paperclip, Globe, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Google,
  Groq,
  OpenRouter,
  Meta,
  DeepSeek,
  Qwen,
  Mistral,
  Gemma,
  Grok,
  Exa,
  Flux,
  Moonshot,
  Perplexity
} from '@lobehub/icons';
import Image from 'next/image';

interface DesktopSearchUIProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement> | string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  selectedModel: string;
  handleModelChange: (modelId: string) => void;
  models: Model[];
  setInput: (value: string) => void;
  description: string;
  messages: { id: string; role: string; content: string }[];
  onAttachmentsChange?: (files: File[]) => void;
  isGuest: boolean;
  guestMessageCount: number;
  guestMessageLimit: number;
  openAuthDialog: () => void;
  sidebarPinned?: boolean;
}

// Inception icon component
const InceptionIcon = () => (
  <div className="h-5 w-5 flex items-center justify-center rounded-sm overflow-hidden">
    <Image src="/inceptionai.png" alt="Inception" width={20} height={20} className="object-contain dark:block hidden" unoptimized />
    <Image src="/inceptionai-lightmode.png" alt="Inception" width={20} height={20} className="object-contain block dark:hidden" unoptimized />
  </div>
);

const getProviderIcon = (avatarType: string, size = 18) => {
  switch (avatarType) {
    case 'google': return <Google.Avatar size={size} />;
    case 'gemma': return <Gemma.Simple size={size} />;
    case 'meta': return <Meta.Avatar size={size} />;
    case 'deepseek': return <DeepSeek.Avatar size={size} />;
    case 'groq': return <Groq.Avatar size={size} />;
    case 'xai': return <Grok.Avatar size={size} />;
    case 'openrouter': return <OpenRouter.Avatar size={size} />;
    case 'mistral': return <Mistral.Avatar size={size} />;
    case 'qwen': return <Qwen.Avatar size={size} />;
    case 'together': return <Flux.Avatar size={size} />;
    case 'moonshotai': return <Moonshot.Avatar size={size} />;
    case 'exa': return <Exa.Avatar size={size} />;
    case 'perplexity': return <Perplexity size={size} />;
    case 'inception': return <InceptionIcon />;
    default: return null;
  }
};

const groupByProvider = (models: Model[]): Record<string, Model[]> => {
  const grouped: Record<string, Model[]> = {};
  models.forEach(model => {
    if (!grouped[model.provider]) grouped[model.provider] = [];
    grouped[model.provider].push(model);
  });
  return grouped;
};

const DesktopSearchUI: React.FC<DesktopSearchUIProps> = ({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  selectedModel,
  handleModelChange,
  models,
  setInput,
  description,
  messages,
  onAttachmentsChange,
  isGuest,
  guestMessageCount,
  guestMessageLimit,
  openAuthDialog,
  sidebarPinned = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Default trending suggestions
  const trendingSuggestions = [
    "Latest AI developments 2025",
    "Best programming languages to learn",
    "Climate change solutions",
    "Space exploration news",
    "Quantum computing explained",
    "Healthy recipes for beginners",
  ];

  // Generate dynamic suggestions based on input
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions(trendingSuggestions);
      return;
    }

    // Generate contextual suggestions based on input
    const inputLower = input.toLowerCase();
    const dynamicSuggestions: string[] = [];

    // Add completion suggestions
    const completions = [
      `${input} explained simply`,
      `${input} tutorial`,
      `${input} best practices`,
      `${input} examples`,
      `How does ${input} work`,
      `What is ${input}`,
    ];

    // Add category-specific suggestions
    if (inputLower.includes('how') || inputLower.includes('what') || inputLower.includes('why')) {
      dynamicSuggestions.push(input);
    } else {
      dynamicSuggestions.push(...completions.slice(0, 4));
    }

    // Filter out duplicates and limit to 6
    const uniqueSuggestions = [...new Set(dynamicSuggestions)].slice(0, 6);
    setSuggestions(uniqueSuggestions);
  }, [input]);

  const isGeminiModel = selectedModel.includes('gemini');
  const selectedModelObj = models.find(model => model.id === selectedModel);
  const groupedModels = groupByProvider(models);
  const disableInput = isGuest && guestMessageCount >= guestMessageLimit;

  useEffect(() => { setHydrated(true); }, []);

  // Handle showing/hiding suggestions with a slight delay for smooth transition
  useEffect(() => {
    if (isFocused) {
      setShowSuggestions(true);
    } else {
      // Small delay before hiding to allow for click events on suggestions
      const timer = setTimeout(() => setShowSuggestions(false), 150);
      return () => clearTimeout(timer);
    }
  }, [isFocused]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading && input.trim()) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleFileButtonClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length > 0) {
      const updated = [...attachments, ...newFiles];
      setAttachments(updated);
      onAttachmentsChange?.(updated);
    }
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const newFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) newFiles.push(file);
      }
    }
    if (newFiles.length > 0) {
      e.preventDefault();
      const updated = [...attachments, ...newFiles];
      setAttachments(updated);
      onAttachmentsChange?.(updated);
    }
  };

  const removeAttachment = (index: number) => {
    const updated = attachments.filter((_, i) => i !== index);
    setAttachments(updated);
    onAttachmentsChange?.(updated);
  };

  const placeholder = selectedModel === 'exa' ? "Search with Exa..." : "Ask anything...";

  const suggestedPrompts = [
    "Explain quantum computing in simple terms",
    "Write a Python function to sort a list",
    "What are the best practices for React?",
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 relative bg-[#F0F0ED] dark:bg-[#0F1516]">
      <div className="w-full max-w-2xl mx-auto relative z-10">
        {/* Header - Perplexity style */}
        <div className="text-center mb-8">
          <h1
            className="text-3xl md:text-4xl text-[#13343B] dark:text-[#F8F8F7] font-medium"
            style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}
          >
            What do you want to know?
          </h1>
        </div>

        {/* Main Input Container - White box like Perplexity */}
        <div className="relative bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E5E5E5] dark:border-[#333] shadow-sm mb-6">
          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className="px-4 pt-3 flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center gap-2 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-lg px-3 py-2">
                  <Paperclip className="h-4 w-4 text-[#64748B]" />
                  <span className="text-xs text-[#13343B] dark:text-[#F8F8F7] max-w-[100px] truncate">{file.name}</span>
                  <button type="button" onClick={() => removeAttachment(index)} className="text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7]">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <div className="px-4 py-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              rows={1}
              disabled={disableInput || isLoading}
              className={cn(
                "w-full resize-none bg-transparent border-none outline-none",
                "text-[#13343B] dark:text-[#F8F8F7] placeholder:text-[#94A3B8]",
                "text-base leading-relaxed min-h-[24px] max-h-[200px]",
                "focus:ring-0 focus:outline-none focus:border-none"
              )}
              style={{ overflow: 'hidden' }}
            />
          </div>

          {/* Bottom Actions Row */}
          <div className="flex items-center justify-between px-3 pb-3">
            {/* Left Actions - Model selector styled as pills */}
            <div className="flex items-center gap-2">
              {/* Model Selector Pill */}
              <Popover open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors",
                      "text-[#13343B] dark:text-[#F8F8F7] border-[#E5E5E5] dark:border-[#333]",
                      "hover:bg-[#F5F5F5] dark:hover:bg-[#2A2A2A]"
                    )}
                  >
                    {selectedModelObj && getProviderIcon(selectedModelObj.avatarType || selectedModelObj.providerId, 14)}
                    <span className="text-sm font-medium max-w-[100px] truncate">
                      {selectedModelObj?.name?.split(' ')[0] || 'Model'}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-64 p-0 bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333] shadow-lg rounded-xl"
                  align="start"
                  sideOffset={8}
                >
                  <div className="max-h-[300px] overflow-y-auto py-1">
                    {Object.entries(groupedModels).map(([provider, providerModels]) => (
                      <div key={provider} className="px-2 py-1">
                        <div className="text-xs font-medium text-[#94A3B8] px-2 py-1.5">{provider}</div>
                        {providerModels.map(model => (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => { handleModelChange(model.id); setModelSelectorOpen(false); }}
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors",
                              selectedModel === model.id ? "bg-[#F0F0ED] dark:bg-[#2A2A2A]" : "hover:bg-[#F8F8F7] dark:hover:bg-[#2A2A2A]"
                            )}
                          >
                            <div className="flex-shrink-0">{getProviderIcon(model.avatarType || model.providerId, 18)}</div>
                            <span className="flex-1 text-sm text-[#13343B] dark:text-[#F8F8F7] truncate">{model.name}</span>
                            {selectedModel === model.id && <Check className="h-4 w-4 text-[#20B8CD] flex-shrink-0" />}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-1">
              {/* Web search indicator */}
              <button
                type="button"
                className="p-2 rounded-full text-[#64748B] hover:text-[#13343B] hover:bg-[#F5F5F5] dark:hover:text-[#F8F8F7] dark:hover:bg-[#2A2A2A] transition-colors"
                title="Web search enabled"
              >
                <Globe className="h-5 w-5" />
              </button>

              {/* Attachment button - only for Gemini models */}
              {isGeminiModel && (
                <button
                  type="button"
                  onClick={handleFileButtonClick}
                  disabled={isLoading}
                  className="p-2 rounded-full text-[#64748B] hover:text-[#13343B] hover:bg-[#F5F5F5] dark:hover:text-[#F8F8F7] dark:hover:bg-[#2A2A2A] transition-colors disabled:opacity-50"
                  title="Attach files"
                >
                  <Paperclip className="h-5 w-5" />
                </button>
              )}

              {/* Send Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={(!input.trim() && attachments.length === 0) || isLoading || disableInput}
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center transition-all",
                  input.trim() || attachments.length > 0
                    ? "bg-[#20B8CD] hover:bg-[#1AA3B6]"
                    : "bg-[#E5E5E5] dark:bg-[#333] cursor-not-allowed"
                )}
              >
                <ArrowUp className={cn(
                  "h-4 w-4",
                  input.trim() || attachments.length > 0 ? "text-white" : "text-[#94A3B8]"
                )} />
              </button>
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" multiple />

          {/* Suggestions Dropdown with smooth transition */}
          <div
            className={cn(
              "border-t border-[#E5E5E5] dark:border-[#333] overflow-hidden transition-all duration-300 ease-in-out",
              showSuggestions && suggestions.length > 0
                ? "max-h-[400px] opacity-100"
                : "max-h-0 opacity-0 border-t-0"
            )}
          >
            <div className="py-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion}-${index}`}
                  type="button"
                  onClick={() => {
                    setInput(suggestion);
                    textareaRef.current?.focus();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F5F5F5] dark:hover:bg-[#2A2A2A] transition-colors"
                >
                  <Search className="h-4 w-4 text-[#94A3B8] flex-shrink-0" />
                  <span className="text-sm text-[#13343B] dark:text-[#F8F8F7] font-ui">
                    {input.trim() && suggestion.toLowerCase().includes(input.toLowerCase()) ? (
                      // Highlight matching text
                      <>
                        {suggestion.split(new RegExp(`(${input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) =>
                          part.toLowerCase() === input.toLowerCase() ? (
                            <span key={i} className="text-[#20B8CD] font-medium">{part}</span>
                          ) : (
                            <span key={i}>{part}</span>
                          )
                        )}
                      </>
                    ) : (
                      suggestion
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Links - Only show for non-authenticated users */}
      {hydrated && !authLoading && !user && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center">
          <div className="flex items-center gap-6 text-sm text-[#64748B]">
            <a
              href="https://github.com/Vinitj088/Aylechat"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#13343B] dark:hover:text-[#F8F8F7] transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/Vinitj088/Aylechat/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#13343B] dark:hover:text-[#F8F8F7] transition-colors"
            >
              Support
            </a>
            <a
              href="https://github.com/Vinitj088/Aylechat#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#13343B] dark:hover:text-[#F8F8F7] transition-colors"
            >
              About
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesktopSearchUI;
