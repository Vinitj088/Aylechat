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

// Helper to extract domain from URL
const getDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
};

// Helper to get favicon URL
const getFaviconUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch {
    return '';
  }
};

export default function Citation({ citations, provider, completed }: CitationProps) {
  const [isVisible, setIsVisible] = useState(false);

  if (!citations || citations.length === 0) {
    return null;
  }

  // Trigger fade-in animation when response is completed
  useEffect(() => {
    if (completed) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [completed]);

  // Show first 3 citations as cards, rest as "+X sources"
  const visibleCitations = citations.slice(0, 3);
  const remainingCount = citations.length - 3;

  return (
    <div
      className={`transition-all duration-500 ease-in-out ${
        isVisible
          ? 'opacity-100 transform translate-y-0'
          : 'opacity-0 transform translate-y-2'
      }`}
    >
      {/* Source cards - horizontal scroll on mobile */}
      <div className="flex items-stretch gap-2 overflow-x-auto pb-2 no-scrollbar">
        {visibleCitations.map((citation, idx) => (
          <a
            key={citation.id || idx}
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 w-[180px] p-3 bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333] rounded-xl hover:border-[#20B8CD] dark:hover:border-[#20B8CD] transition-colors group font-ui"
          >
            {/* Domain with favicon */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <img
                src={citation.favicon || getFaviconUrl(citation.url)}
                alt=""
                className="w-4 h-4 rounded-sm object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="text-xs text-[#64748B] truncate">
                {getDomain(citation.url)}
              </span>
            </div>
            {/* Title */}
            <p className="text-sm text-[#13343B] dark:text-[#F8F8F7] font-medium line-clamp-2 group-hover:text-[#20B8CD] transition-colors">
              {citation.title || getDomain(citation.url)}
            </p>
          </a>
        ))}

        {/* +X sources card */}
        {remainingCount > 0 && (
          <div className="flex-shrink-0 w-[100px] p-3 bg-[#F5F5F5] dark:bg-[#2A2A2A] border border-[#E5E5E5] dark:border-[#333] rounded-xl flex flex-col items-center justify-center font-ui">
            <div className="flex items-center gap-1 mb-1">
              {/* Small favicon stack */}
              <div className="flex -space-x-1">
                {citations.slice(3, 6).map((c, i) => (
                  <img
                    key={i}
                    src={c.favicon || getFaviconUrl(c.url)}
                    alt=""
                    className="w-4 h-4 rounded-full border border-white dark:border-[#2A2A2A] object-contain bg-white"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ))}
              </div>
            </div>
            <span className="text-sm text-[#64748B] font-medium">
              +{remainingCount} sources
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
