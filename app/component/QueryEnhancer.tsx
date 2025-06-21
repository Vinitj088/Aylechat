import React, { useState } from 'react';
import { Sparkles, Bot, Star } from 'lucide-react';
import { useQueryEnhancer } from '@/context/QueryEnhancerContext';
import { enhanceQuery } from '../api/apiService';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface QueryEnhancerProps {
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  isMobile: boolean;
}

const QueryEnhancer: React.FC<QueryEnhancerProps> = ({ input, setInput, isLoading, isMobile }) => {
  const { enhancerMode, toggleEnhancerMode } = useQueryEnhancer();
  const [isEnhancing, setIsEnhancing] = useState(false);
  const { user } = useAuth();
  const isAuthenticated = !!user;

  const handleManualEnhance = async () => {
    if (!input.trim() || isLoading || isEnhancing) return;

    if (!isAuthenticated) {
      toast.error('Please sign in to enhance queries');
      return;
    }
    
    setIsEnhancing(true);
    toast.loading('Enhancing your query...', { id: 'enhancing-query' });
    try {
      const enhancedQuery = await enhanceQuery(input);
      setInput(enhancedQuery);
      toast.success('Query enhanced!', { id: 'enhancing-query' });
    } catch (error) {
      console.error('Error enhancing query:', error);
      toast.error('Failed to enhance query', { id: 'enhancing-query' });
    } finally {
      setIsEnhancing(false);
    }
  };

  const isDisabled = !input.trim() || isLoading || isEnhancing;

  if (enhancerMode === 'auto') {
    return (
      <button
        type="button"
        onClick={toggleEnhancerMode}
        className="flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 text-zinc-400 hover:bg-green-500/10 hover:text-green-400"
        title="Auto-Enhance Active. Click to switch to manual."
      >
        <Sparkles className="w-5 h-5" />
      </button>
    );
  }

  // Manual Mode UI from your design
  return (
    <div className={cn(
      "flex items-center rounded-md border border-zinc-700 h-8 text-sm transition-all bg-zinc-800/50",
      isDisabled ? "opacity-60 cursor-not-allowed" : ""
    )}>
      <button
        type="button"
        onClick={handleManualEnhance}
        disabled={isDisabled}
        className="flex items-center gap-1.5 px-2.5 h-full text-zinc-300 hover:bg-yellow-400/10 hover:text-yellow-400 rounded-l-md"
        title="Enhance query manually"
      >
        <Star className="w-4 h-4 text-yellow-500/80" fill="currentColor"/>
        {!isMobile && <span className="font-medium text-xs">Enhance</span>}
      </button>
      <div className="w-px h-full bg-zinc-700"></div>
      <button
        type="button"
        onClick={toggleEnhancerMode}
        disabled={isLoading || isEnhancing}
        className="flex items-center justify-center px-2 h-full text-zinc-400 hover:bg-zinc-700 hover:text-white rounded-r-md"
        title="Switch to auto enhancement"
      >
        <Bot className="w-4 h-4" />
      </button>
    </div>
  );
};

export default QueryEnhancer; 