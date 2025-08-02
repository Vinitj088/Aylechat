import React, { useState, useEffect } from 'react';

interface Citation {
  id?: string;
  url: string;
  title?: string;
  favicon?: string;
}

interface CitationProps {
  citations: Citation[];
  provider?: string;
  completed?: boolean;
}

export default function Citation({ citations, provider, completed }: CitationProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Debug log
  console.log('Citation component received:', citations, 'provider:', provider, 'completed:', completed);

  if (!citations || citations.length === 0) {
    console.log('No citations to display');
    return null;
  }

  // Trigger fade-in animation when response is completed
  useEffect(() => {
    if (completed) {
      // Small delay to ensure the response has finished rendering
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [completed]);

  // Determine the title based on provider
  const getTitle = () => {
    switch (provider?.toLowerCase()) {
      case 'perplexity':
        return 'Perplexity Search Results';
      case 'exa':
      default:
        return 'Exa Search Results';
    }
  };

  return (
    <div 
      className={`mt-4 space-y-4 transition-all duration-700 ease-in-out ${
        isVisible 
          ? 'opacity-100 transform translate-y-0' 
          : 'opacity-0 transform translate-y-2'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <h3 className="text-md font-medium text-[var(--text-light-default)]">{getTitle()}</h3>
      </div>

      {/* Results */}
      <div className="pl-0 md:pl-4">
        <div className="space-y-2">
          {citations.map((citation, idx) => (
            <div key={citation.id || idx} className="text-sm w-full">
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text-light-muted)] hover:text-[var(--brand-default)] flex items-center gap-2 max-w-full break-all overflow-x-auto"
                title={citation.url}
              >
                [{idx + 1}] {citation.title || citation.url}
                {citation.favicon && (
                  <img
                    src={citation.favicon}
                    alt=""
                    className="w-4 h-4 object-contain"
                  />
                )}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 