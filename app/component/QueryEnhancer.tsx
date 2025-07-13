import React, { useState } from 'react';
import { SpellCheck  , Bot, Star, Sparkles } from 'lucide-react';
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
        className="flex items-center justify-center w-8 h-8 rounded-[var(--radius)] text-primary bg-primary/10"
        title="Auto-Enhance Active. Click to switch to manual."
      >
        <SpellCheck   className="w-5 h-5" />
      </button>
    );
  }

  // Manual Mode UI from your design
  return (
    <div className={cn(
      "flex items-center rounded-[var(--radius)] border border-border h-8 text-sm transition-all bg-secondary text-muted-foreground",
      isDisabled ? "opacity-60 cursor-not-allowed" : ""
    )}>
      <button
        type="button"
        onClick={toggleEnhancerMode}
        disabled={isLoading || isEnhancing}
        className="flex items-center justify-center px-2 h-full text-muted-foreground hover:bg-accent rounded-r-[var(--radius)]"
        title="Switch to auto enhancement"
      >
        <SpellCheck className="w-4 h-4" />
      </button>
      <div className="w-px h-full bg-border"></div>

      <button
        type="button"
        onClick={handleManualEnhance}
        disabled={isDisabled}
        className="flex items-center gap-1.5 px-2.5 h-full hover:bg-accent/10 text-foreground rounded-l-[var(--radius)]"
        title="Enhance query manually"
      >
        <Star className="w-4 h-4 text-primary" fill="currentColor"/>
        {!isMobile && <span className="font-medium text-xs">Enhance</span>}
      </button>
      
    </div>
  );
};

export default QueryEnhancer; 