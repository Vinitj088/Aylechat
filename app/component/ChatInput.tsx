import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import { Model } from '../types';
import { Button } from "@/components/ui/button";
import { ArrowUp, Plus, X, Paperclip, Square, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQueryEnhancer } from '@/context/QueryEnhancerContext';
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

export interface ChatInputHandle {
  focus: () => void;
}

interface Attachment {
  file: File;
  previewUrl?: string;
}

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement> | string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  selectedModel: string;
  handleModelChange: (modelId: string) => void;
  models: Model[];
  isExa: boolean;
  onNewChat: () => void;
  onAttachmentsChange?: (files: File[]) => void;
  activeChatFiles?: Array<{ name: string; type: string; uri: string }>;
  removeActiveFile?: (uri: string) => void;
  onActiveFilesHeightChange?: (height: number) => void;
  quotedText?: string;
  setQuotedText?: (text: string) => void;
  sidebarPinned?: boolean;
  onStop?: () => void;
}

// Inception icon component
const InceptionIcon = () => (
  <div className="h-5 w-5 flex items-center justify-center rounded-sm overflow-hidden">
    <Image
      src="/inceptionai.png"
      alt="Inception"
      width={20}
      height={20}
      className="object-contain dark:block hidden"
      unoptimized
    />
    <Image
      src="/inceptionai-lightmode.png"
      alt="Inception"
      width={20}
      height={20}
      className="object-contain block dark:hidden"
      unoptimized
    />
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

// Group models by provider
const groupByProvider = (models: Model[]): Record<string, Model[]> => {
  const grouped: Record<string, Model[]> = {};
  models.forEach(model => {
    if (!grouped[model.provider]) grouped[model.provider] = [];
    grouped[model.provider].push(model);
  });
  return grouped;
};

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  selectedModel,
  handleModelChange,
  models,
  isExa,
  onNewChat,
  onAttachmentsChange,
  activeChatFiles,
  removeActiveFile,
  onActiveFilesHeightChange,
  quotedText,
  setQuotedText,
  sidebarPinned = false,
  onStop
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const activeFilesContainerRef = useRef<HTMLDivElement>(null);

  const isGeminiModel = selectedModel.includes('gemini');
  const selectedModelObj = models.find(model => model.id === selectedModel);
  const groupedModels = groupByProvider(models);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus()
  }));

  // Update parent when attachments change
  useEffect(() => {
    onAttachmentsChange?.(attachments.map(a => a.file));
  }, [attachments, onAttachmentsChange]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  // Measure active files height
  useEffect(() => {
    const height = activeFilesContainerRef.current?.clientHeight || 0;
    onActiveFilesHeightChange?.(height);
  }, [activeChatFiles, onActiveFilesHeightChange]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach(a => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    };
  }, [attachments]);

  const handleFileButtonClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments = Array.from(files).map(file => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }));

    setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const updated = [...prev];
      if (updated[index].previewUrl) URL.revokeObjectURL(updated[index].previewUrl);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleSubmitWithAttachments = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;

    onAttachmentsChange?.(attachments.map(a => a.file));
    handleSubmit(e);

    attachments.forEach(a => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.shiftKey) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
      if (isMobile) return;

      if (!isLoading && input.trim()) {
        e.preventDefault();
        handleSubmitWithAttachments(e as unknown as React.FormEvent);
      } else {
        e.preventDefault();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const newAttachments: Attachment[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          newAttachments.push({ file, previewUrl: URL.createObjectURL(file) });
        }
      }
    }

    if (newAttachments.length > 0) {
      e.preventDefault();
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e);
  }, [handleInputChange]);

  const placeholder = isExa ? "Search with Exa..." : "Message Ayle...";

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 bg-transparent">
      {/* Active Files */}
      {activeChatFiles && activeChatFiles.length > 0 && removeActiveFile && (
        <div
          ref={activeFilesContainerRef}
          className="mb-2 flex gap-2 flex-wrap"
        >
          {activeChatFiles.map((file) => (
            <div
              key={file.uri}
              className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs px-2.5 py-1.5 rounded-full"
            >
              <Paperclip className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{file.name}</span>
              <button
                type="button"
                onClick={() => removeActiveFile(file.uri)}
                className="ml-0.5 hover:text-neutral-900 dark:hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quote Block */}
      {quotedText && quotedText.trim().length > 0 && (
        <div className="mb-2 flex items-start bg-[var(--secondary-darker)] border-l-4 border-[var(--brand-default)] rounded-r-lg p-3 relative">
          <span className="text-neutral-600 dark:text-neutral-400 text-sm flex-1 line-clamp-3">
            {quotedText}
          </span>
          {setQuotedText && (
            <button
              type="button"
              onClick={() => setQuotedText('')}
              className="ml-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Main Input Container */}
      <div className="relative bg-[var(--secondary-dark)] dark:bg-[var(--secondary-faint)] rounded-lg border border-[var(--secondary-darkest)]">
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="px-4 pt-3 flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <div key={index} className="relative">
                {attachment.previewUrl ? (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-600">
                    <img
                      src={attachment.previewUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="absolute -top-1 -right-1 bg-neutral-800 text-white rounded-full p-0.5 shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="relative flex items-center gap-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg px-3 py-2">
                    <Paperclip className="h-4 w-4 text-neutral-500" />
                    <span className="text-xs text-neutral-600 dark:text-neutral-300 max-w-[100px] truncate">
                      {attachment.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-neutral-400 hover:text-neutral-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <div className="px-4 py-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            rows={1}
            disabled={isLoading}
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
            {/* Attachment Button - Only for Gemini models */}
            {isGeminiModel && (
              <button
                type="button"
                onClick={handleFileButtonClick}
                disabled={isLoading}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200",
                  "dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-700",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
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
                      <div className="text-xs font-medium text-neutral-400 dark:text-neutral-500 px-2 py-1.5">
                        {provider}
                      </div>
                      {providerModels.map(model => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            handleModelChange(model.id);
                            setModelSelectorOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors",
                            selectedModel === model.id
                              ? "bg-neutral-100 dark:bg-neutral-800"
                              : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                          )}
                        >
                          <div className="flex-shrink-0">
                            {getProviderIcon(model.avatarType || model.providerId, 18)}
                          </div>
                          <span className="flex-1 text-sm text-neutral-700 dark:text-neutral-300 truncate">
                            {model.name}
                          </span>
                          {selectedModel === model.id && (
                            <Check className="h-4 w-4 text-[var(--brand-default)] flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Right Actions - Send/Stop Button */}
          <div>
            {isLoading && onStop ? (
              <Button
                type="button"
                size="icon"
                onClick={onStop}
                className="h-8 w-8 rounded-full bg-neutral-800 hover:bg-neutral-700 dark:bg-neutral-200 dark:hover:bg-neutral-300"
              >
                <Square className="h-3.5 w-3.5 text-white dark:text-neutral-800" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                onClick={handleSubmitWithAttachments}
                disabled={(!input.trim() && attachments.length === 0) || isLoading}
                className={cn(
                  "h-8 w-8 rounded-full transition-all",
                  input.trim() || attachments.length > 0
                    ? "bg-neutral-800 hover:bg-neutral-700 dark:bg-neutral-200 dark:hover:bg-neutral-300"
                    : "bg-neutral-300 dark:bg-neutral-600 cursor-not-allowed"
                )}
              >
                <ArrowUp className={cn(
                  "h-4 w-4",
                  input.trim() || attachments.length > 0
                    ? "text-white dark:text-neutral-800"
                    : "text-neutral-500 dark:text-neutral-400"
                )} />
              </Button>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileChange}
          className="hidden"
          multiple
        />
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;
