import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { enhanceQuery } from '../api/apiService';
import { toast } from 'sonner';

interface QueryEnhancerProps {
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
}

const QueryEnhancer: React.FC<QueryEnhancerProps> = ({ input, setInput, isLoading }) => {
  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleEnhanceQuery = async () => {
    if (!input.trim() || isLoading || isEnhancing) return;
    
    try {
      setIsEnhancing(true);
      
      // Show loading toast
      toast.loading('Enhancing your query...', { id: 'enhancing-query' });
      
      // Send the query for enhancement
      const enhancedQuery = await enhanceQuery(input);
      
      // Update the input with the enhanced query
      setInput(enhancedQuery);
      
      // Show success toast
      toast.success('Query enhanced!', { id: 'enhancing-query' });
    } catch (error) {
      console.error('Error enhancing query:', error);
      toast.error('Failed to enhance query', { id: 'enhancing-query' });
    } finally {
      setIsEnhancing(false);
    }
  };

  // Determine if the button should be disabled
  const isDisabled = !input.trim() || isLoading || isEnhancing;

  return (
    <button
      type="button"
      onClick={handleEnhanceQuery}
      disabled={isDisabled}
      className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 
        ${isDisabled 
          ? 'text-gray-300 cursor-not-allowed' 
          : 'text-yellow-500 hover:text-yellow-600 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      title="Enhance query using AI"
      aria-label="Enhance query using AI"
    >
      <Sparkles className="w-5 h-5" />
    </button>
  );
};

export default QueryEnhancer; 