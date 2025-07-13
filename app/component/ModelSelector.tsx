import React, { useState } from 'react';
import Image from 'next/image';
import { Model } from '../types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Info, Globe, FileText, Brain, Code, Eye, Clock, Image as ImageIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  Flux
} from '@lobehub/icons';

interface ModelSelectorProps {
  selectedModel: string;
  handleModelChange: (modelId: string) => void;
  models: Model[];
}

// Model capabilities based on model IDs
const modelCapabilities: Record<string, string[]> = {
  'mistralai/mistral-small-3.1-24b-instruct:free': ['docs'],
  'gemini-2.0-flash': ['vision', 'web', 'docs'],
  'gemini-2.0-flash-exp-image-generation': ['images', 'experimental'],
  'black-forest-labs/FLUX.1-schnell-Free': ['images'],
  'gemma3-27b': ['docs'],
  'llama-3.3-70b-versatile': ['docs'],
  'deepseek-r1-distill-llama-70b': ['reasoning'],
  'deepseek-r1-distill-qwen-32b': ['reasoning', 'docs'],
  'qwen-qwq-32b': ['reasoning'],
  'deepseek/deepseek-r1:free': ['reasoning', 'code', 'docs'],
  'qwen-2.5-coder-32b': ['code', 'docs'],
};

// Function to get capability icon
const getCapabilityIcon = (capability: string) => {
  switch (capability) {
    case 'vision':
      return <span title="Vision capability" className="text-blue-600 dark:text-blue-400"><Eye size={16} /></span>;
    case 'web':
      return <span title="Web search capability" className="text-purple-600 dark:text-purple-400"><Globe size={16} /></span>;
    case 'docs':
      return <span title="Document analysis capability" className="text-green-600 dark:text-green-400"><FileText size={16} /></span>;
    case 'reasoning':
      return <span title="Advanced reasoning capability" className="text-amber-600 dark:text-amber-400"><Brain size={16} /></span>;
    case 'code':
      return <span title="Code generation capability" className="text-cyan-600 dark:text-cyan-400"><Code size={16} /></span>;
    case 'quick responses':
      return <span title="Quick Response times" className="text-amber-600 dark:text-amber-400"><Clock size={16} /></span>;
    case 'images':
      return <span title="Image generation capability" className="text-pink-600 dark:text-pink-400"><ImageIcon size={16} /></span>;
    case 'experimental':
      return <span title="Experimental feature" className="text-red-600 dark:text-red-400">⚠️</span>;
    default:
      return null;
  }
};

const getProviderIconByAvatarType = (avatarType: string) => {
  switch (avatarType) {
    case 'google':
      return <Google.Avatar size={20} />;
    case 'gemma':
      return <Gemma.Simple size={20} />;
    case 'meta':
      return <Meta.Avatar size={20} />;
    case 'deepseek':
      return <DeepSeek.Avatar size={20} />;
    case 'groq':
      return <Groq.Avatar size={20} />;
    case 'xai':
      return <Grok.Avatar size={20} />;
    case 'openrouter':
      return <OpenRouter.Avatar size={20} />;
    case 'mistral':
      return <Mistral.Avatar size={20} />;
    case 'qwen':
      return <Qwen.Avatar size={20} />;
    case 'together':
      return <Flux.Avatar size={20} />;
    case 'exa':
      return <Exa.Avatar size={20} />;
    default:
      return (
        <div className="h-5 w-5 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
          <span className="text-xs text-gray-800 dark:text-gray-200">{avatarType.charAt(0).toUpperCase()}</span>
        </div>
      );
  }
};

// For grouping models by provider name
const groupByProvider = (models: Model[]): Record<string, Model[]> => {
  const grouped: Record<string, Model[]> = {};

  models.forEach(model => {
    if (!grouped[model.provider]) {
      grouped[model.provider] = [];
    }
    grouped[model.provider].push(model);
  });

  return grouped;
};

const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, handleModelChange, models }) => {
  const [open, setOpen] = useState(false);

  // Get the selected model object
  const selectedModelObj = models.find(model => model.id === selectedModel);

  // Group models by provider
  const groupedModels = groupByProvider(models);

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full sm:w-[200px] md:w-[240px] justify-between bg-background border border-border hover:border-primary active:scale-[0.98] text-foreground transition-none"
          >
            <div className="flex items-center gap-2 w-full min-w-0">
              <div className="flex-shrink-0">
                {selectedModelObj ? (
                  getProviderIconByAvatarType(selectedModelObj.avatarType || selectedModelObj.providerId)
                ) : (
                  <div className="h-5 w-5 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                    <span className="text-xs text-gray-800 dark:text-gray-200">?</span>
                  </div>
                )}
              </div>
              <span className="truncate text-[var(--text-light-default)] text-sm">{selectedModelObj?.name || "Select model..."}</span>
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[85vw] sm:w-[200px] md:w-[240px] p-0 bg-background border border-border shadow-lg z-50 transition-none"
          sideOffset={5}
          align="start"
        >
          <div className="max-h-[300px] overflow-y-auto">
            {Object.entries(groupedModels).map(([provider, providerModels]) => (
              <div key={provider} className="px-2 pt-2 pb-1">
                <div className="text-xs font-medium text-muted-foreground px-1 mb-1">{provider}</div>
                {providerModels.map(model => {
                  const isActive = selectedModel === model.id;
                  const capabilities = modelCapabilities[model.id] || [];

                  return (
                    <div
                      key={model.id}
                      className={`flex items-center gap-2 py-2 px-2 hover:bg-accent focus:bg-accent cursor-pointer rounded-[var(--radius)] ${isActive ? 'bg-primary/10 dark:bg-primary/20' : ''}`}
                      onClick={() => {
                        handleModelChange(model.id);
                        setOpen(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleModelChange(model.id);
                          setOpen(false);
                        }
                      }}
                      tabIndex={0}
                      role="option"
                      aria-selected={isActive}
                      data-testid={`model-option-${model.id}`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                        <div className="flex-shrink-0">
                          {getProviderIconByAvatarType(model.avatarType || model.providerId)}
                        </div>
                        <span className={`truncate text-foreground text-sm ${isActive ? 'font-medium' : 'font-normal'}`}>
                          {model.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {capabilities.map(capability => (
                          <span key={capability}>{getCapabilityIcon(capability)}</span>
                        ))}

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="ml-1 h-5 w-5 rounded-[var(--radius)] flex items-center justify-center text-muted-foreground hover:text-foreground bg-secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                }}
                              >
                                <Info size={14} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="bg-background border shadow-md z-[60] text-foreground">
                              <p className="font-medium">{model.name}</p>
                              <p className="text-xs text-[var(--text-light-muted)]">{model.provider}</p>
                              {capabilities.length > 0 && (
                                <div className="mt-1">
                                  <p className="text-xs font-medium">Capabilities:</p>
                                  <ul className="text-xs list-disc pl-3 mt-1">
                                    {capabilities.includes('vision') && <li>Vision</li>}
                                    {capabilities.includes('web') && <li>Web access</li>}
                                    {capabilities.includes('docs') && <li>Document analysis</li>}
                                    {capabilities.includes('reasoning') && <li>Advanced reasoning</li>}
                                    {capabilities.includes('code') && <li>Code generation</li>}
                                  </ul>
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {isActive && <Check className="h-4 w-4 text-primary" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default ModelSelector; 