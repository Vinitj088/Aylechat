import React from 'react';

interface Citation {
  id?: string;
  url: string;
  title?: string;
  favicon?: string;
}

interface CitationProps {
  citations: Citation[];
}

export default function Citation({ citations }: CitationProps) {
  // Debug log
  console.log('Citation component received:', citations);

  if (!citations || citations.length === 0) {
    console.log('No citations to display');
    return null;
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h3 className="text-md font-medium text-[var(--text-light-default)]">Exa Search Results</h3>
      </div>

      {/* Results */}
      <div className="pl-4">
        <div className="space-y-2">
          {citations.map((citation, idx) => (
            <div key={citation.id || idx} className="text-sm group relative">
              <a href={citation.url} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="text-[var(--text-light-muted)] hover:text-[var(--brand-default)] flex items-center gap-2">
                [{idx + 1}] {citation.title || citation.url}
                {citation.favicon && (
                  <img 
                    src={citation.favicon} 
                    alt=""
                    className="w-4 h-4 object-contain"
                  />
                )}
              </a>
              {/* URL tooltip */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-0 -bottom-6 bg-gray-800 dark:bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none">
                {citation.url}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 