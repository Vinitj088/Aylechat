import React, { useRef, useEffect, useState } from 'react';
import { Model } from '../types';
import { ArrowUp, Plus, X, ChevronDown, Check, Paperclip } from 'lucide-react';
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
import Snowfall from './Snowfall';

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
  const { user, isLoading: authLoading } = useAuth();
  const [hydrated, setHydrated] = useState(false);

  const isGeminiModel = selectedModel.includes('gemini');
  const selectedModelObj = models.find(model => model.id === selectedModel);
  const groupedModels = groupByProvider(models);
  const disableInput = isGuest && guestMessageCount >= guestMessageLimit;

  useEffect(() => { setHydrated(true); }, []);

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

  const placeholder = selectedModel === 'exa' ? "Search with Exa..." : "Message Ayle...";

  const suggestedPrompts = [
    "Explain quantum computing in simple terms",
    "Write a Python function to sort a list",
    "What are the best practices for React?",
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <Snowfall count={80} />
      <div className="w-full max-w-2xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          {hydrated && !authLoading && !user && (
            <button
              onClick={openAuthDialog}
              className="inline-block mb-4 px-4 py-1.5 rounded-full text-sm font-medium
                bg-[var(--brand-dark)] text-white hover:bg-[var(--brand-default)] transition-colors"
            >
              Sign in for unlimited access
            </button>
          )}
          <h1
            className="text-5xl md:text-6xl text-neutral-900 dark:text-neutral-100 mb-3 font-normal"
            style={{ fontFamily: 'Gebuk, system-ui, sans-serif', letterSpacing: '0.02em', fontWeight: 400 }}
          >
            Ayle
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-base">
            {description}
          </p>
        </div>

        {/* Main Input Container */}
        <div className="relative bg-[var(--secondary-dark)] dark:bg-[var(--secondary-faint)] rounded-lg border border-[var(--secondary-darkest)] mb-6">
          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className="px-4 pt-3 flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center gap-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg px-3 py-2">
                  <Paperclip className="h-4 w-4 text-neutral-500" />
                  <span className="text-xs text-neutral-600 dark:text-neutral-300 max-w-[100px] truncate">{file.name}</span>
                  <button type="button" onClick={() => removeAttachment(index)} className="text-neutral-400 hover:text-neutral-600">
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
              placeholder={placeholder}
              rows={1}
              disabled={disableInput || isLoading}
              className={cn(
                "w-full resize-none bg-transparent border-none outline-none",
                "text-[var(--text-light-default)] placeholder:text-[var(--text-light-muted)]",
                "text-base leading-relaxed min-h-[24px] max-h-[200px]",
                "focus:ring-0 focus:outline-none focus:border-none"
              )}
              style={{ overflow: 'hidden' }}
            />
          </div>

          {/* Bottom Actions Row */}
          <div className="flex items-center justify-between px-3 pb-3">
            {/* Left Actions */}
            <div className="flex items-center gap-1">
              {isGeminiModel && (
                <button
                  type="button"
                  onClick={handleFileButtonClick}
                  disabled={isLoading}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200",
                    "dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-700",
                    "disabled:opacity-50"
                  )}
                  title="Attach files"
                >
                  <Plus className="h-5 w-5" />
                </button>
              )}

              {/* Model Selector */}
              <Popover open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors",
                      "text-neutral-600 hover:bg-neutral-200",
                      "dark:text-neutral-400 dark:hover:bg-neutral-800"
                    )}
                  >
                    {selectedModelObj && getProviderIcon(selectedModelObj.avatarType || selectedModelObj.providerId, 16)}
                    <span className="text-sm font-medium max-w-[100px] truncate">
                      {selectedModelObj?.name?.split(' ')[0] || 'Model'}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-64 p-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-lg"
                  align="start"
                  sideOffset={8}
                >
                  <div className="max-h-[300px] overflow-y-auto py-1">
                    {Object.entries(groupedModels).map(([provider, providerModels]) => (
                      <div key={provider} className="px-2 py-1">
                        <div className="text-xs font-medium text-neutral-400 dark:text-neutral-500 px-2 py-1.5">{provider}</div>
                        {providerModels.map(model => (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => { handleModelChange(model.id); setModelSelectorOpen(false); }}
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors",
                              selectedModel === model.id ? "bg-neutral-100 dark:bg-neutral-800" : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                            )}
                          >
                            <div className="flex-shrink-0">{getProviderIcon(model.avatarType || model.providerId, 18)}</div>
                            <span className="flex-1 text-sm text-neutral-700 dark:text-neutral-300 truncate">{model.name}</span>
                            {selectedModel === model.id && <Check className="h-4 w-4 text-[var(--brand-default)] flex-shrink-0" />}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Send Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={(!input.trim() && attachments.length === 0) || isLoading || disableInput}
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center transition-all",
                input.trim() || attachments.length > 0
                  ? "bg-neutral-800 hover:bg-neutral-700 dark:bg-neutral-200 dark:hover:bg-neutral-300"
                  : "bg-neutral-300 dark:bg-neutral-600 cursor-not-allowed"
              )}
            >
              <ArrowUp className={cn(
                "h-4 w-4",
                input.trim() || attachments.length > 0 ? "text-white dark:text-neutral-800" : "text-neutral-500 dark:text-neutral-400"
              )} />
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" multiple />
        </div>

        {/* Suggested Prompts */}
        <div className="flex flex-wrap justify-center gap-2">
          {suggestedPrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => setInput(prompt)}
              className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 bg-transparent dark:bg-neutral-900
                border border-neutral-300 dark:border-neutral-700 rounded-lg
                hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800
                transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DesktopSearchUI;
