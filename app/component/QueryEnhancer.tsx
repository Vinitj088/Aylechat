import React, { useState } from 'react';
import { SpellCheck, Star } from 'lucide-react';
import { useQueryEnhancer } from '@/context/QueryEnhancerContext';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface QueryEnhancerProps {
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  isMobile: boolean;
}

// Simple query enhancement using Google Gemini API
async function enhanceQuery(query: string): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-2.5-flash', // Using Google model as it's always available
      messages: [{
        role: 'user',
        content: `Rewrite this query to be clearer and more effective for an AI search. Only return the improved query, nothing else:\n\n"${query}"`
      }]
    })
  });

  if (!response.ok) throw new Error('Failed to enhance query');

  // Read streaming response
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  let result = '';
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    // Parse AI SDK data stream format
    const lines = chunk.split('\n').filter(Boolean);
    for (const line of lines) {
      if (line.startsWith('0:')) {
        try {
          result += JSON.parse(line.slice(2));
        } catch {
          // Skip malformed lines
        }
      }
    }
  }

  return result.trim() || query;
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
        className="flex items-center justify-center w-8 h-8 !rounded-md text-[var(--brand-default)] bg-[var(--brand-default)]/10"
        title="Auto-Enhance Active. Click to switch to manual."
      >
        <SpellCheck className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className={cn(
      "flex items-center rounded-md border border-zinc-700 h-8 text-sm transition-all bg-zinc-200/50 dark:bg-zinc-800/50 dark:text-zinc-400",
      isDisabled ? "opacity-60 cursor-not-allowed" : ""
    )}>
      <button
        type="button"
        onClick={toggleEnhancerMode}
        disabled={isLoading || isEnhancing}
        className="flex items-center justify-center px-2 h-full text-zinc-400 hover:bg-zinc-700 hover:text-white rounded-r-md"
        title="Switch to auto enhancement"
      >
        <SpellCheck className="w-4 h-4" />
      </button>
      <div className="w-px h-full bg-zinc-700"></div>

      <button
        type="button"
        onClick={handleManualEnhance}
        disabled={isDisabled}
        className="flex items-center gap-1.5 px-2.5 h-full dark:hover:bg-yellow-400/25 hover:bg-yellow-400/10 text-black rounded-l-md"
        title="Enhance query manually"
      >
        <Star className="w-4 h-4 text-yellow-500/80" fill="currentColor" />
        {!isMobile && <span className="font-medium text-xs">Enhance</span>}
      </button>
    </div>
  );
};

export default QueryEnhancer;
