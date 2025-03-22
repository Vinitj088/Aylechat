import React, { useState } from 'react';
import Image from 'next/image';
import { Model } from '../types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Info, Globe, FileText, Brain } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Google,
  Groq,
  OpenRouter,
  Meta,
  DeepSeek,
  Qwen,
  Mistral,
  Gemma
} from '@lobehub/icons';

interface ModelSelectorProps {
  selectedModel: string;
  handleModelChange: (modelId: string) => void;
  models: Model[];
}

// Model capabilities based on model IDs
const modelCapabilities: Record<string, string[]> = {
  'mistralai/mistral-small-3.1-24b-instruct:free': ['reasoning', 'docs'],
  'gemini-2.0-flash': ['vision', 'web', 'docs'],
  'gemini-1.5-pro': ['vision', 'docs'],
  'gemma3-27b': ['docs'],
  'llama-3.3-70b-versatile': ['reasoning', 'docs'],
  'deepseek-r1-distill-llama-70b': ['reasoning'],
  'deepseek-r1-distill-qwen-32b': ['reasoning', 'docs'],
  'qwen-qwq-32b': ['reasoning'],
  'deepseek/deepseek-r1:free': ['reasoning', 'code', 'docs'],
  'qwen-2.5-coder-32b': ['reasoning', 'code', 'docs'],
};

// Function to get capability icon
const getCapabilityIcon = (capability: string) => {
  switch (capability) {
    case 'vision':
      return <span title="Vision capability" className="text-blue-600"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></span>;
    case 'web':
      return <span title="Web search capability" className="text-purple-600"><Globe size={16} /></span>;
    case 'docs':
      return <span title="Document analysis capability" className="text-green-600"><FileText size={16} /></span>;
    case 'reasoning':
      return <span title="Advanced reasoning capability" className="text-amber-600"><Brain size={16} /></span>;
    case 'code':
      return <span title="Code generation capability" className="text-cyan-600"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></span>;
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
    case 'openrouter':
      return <OpenRouter.Avatar size={20} />;
    case 'mistral':
      return <Mistral.Avatar size={20} />;
    case 'qwen':
      return <Qwen.Avatar size={20} />;
    case 'exa':
      return (
        <div className="h-5 w-5 flex items-center justify-center">
          <Image
            src="/exalogo.png"
            alt="Exa"
            width={18}
            height={18}
            className="object-contain"
          />
        </div>
      );
    default:
      return (
        <div className="h-5 w-5 flex items-center justify-center rounded-full bg-gray-100">
          <span className="text-xs">{avatarType.charAt(0).toUpperCase()}</span>
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
            className="w-full sm:w-[200px] md:w-[240px] justify-between bg-white border border-gray-300 hover:border-gray-400 active:scale-[0.98] text-gray-900"
          >
            <div className="flex items-center gap-2 w-full min-w-0">
              <div className="flex-shrink-0">
                {selectedModelObj ? (
                  getProviderIconByAvatarType(selectedModelObj.avatarType || selectedModelObj.providerId)
                ) : (
                  <div className="h-5 w-5 flex items-center justify-center rounded-full bg-gray-100">
                    <span className="text-xs">?</span>
                  </div>
                )}
              </div>
              <span className="truncate text-gray-900 text-sm">{selectedModelObj?.name || "Select model..."}</span>
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[85vw] sm:w-[200px] md:w-[240px] p-0 bg-white border border-gray-300 shadow-lg z-50" 
          sideOffset={5}
          align="start"
        >
          <div className="max-h-[300px] overflow-y-auto">
            {Object.entries(groupedModels).map(([provider, providerModels]) => (
              <div key={provider} className="px-2 pt-2 pb-1">
                <div className="text-xs font-medium text-gray-500 px-1 mb-1">{provider}</div>
                {providerModels.map(model => {
                  const isActive = selectedModel === model.id;
                  const capabilities = modelCapabilities[model.id] || [];
                  
                  return (
                    <div 
                      key={model.id}
                      className={`flex items-center gap-2 py-2 px-2 hover:bg-blue-50 focus:bg-blue-50 cursor-pointer rounded-sm ${isActive ? 'bg-blue-100' : ''}`}
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
                        <span className={`truncate text-gray-900 text-sm ${isActive ? 'font-medium' : 'font-normal'}`}>
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
                                className="ml-1 h-5 w-5 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 bg-gray-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                }} 
                              >
                                <Info size={14} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="bg-white border shadow-md z-[60] text-gray-900">
                              <p className="font-medium">{model.name}</p>
                              <p className="text-xs text-gray-500">{model.provider}</p>
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
                        
                        {isActive && <Check className="h-4 w-4 text-blue-600" />}
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