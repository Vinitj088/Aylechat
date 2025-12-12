import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ExternalLink } from 'lucide-react';

interface Citation {
  id?: string;
  url: string;
  title?: string;
  snippet?: string;
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
  const [sheetOpen, setSheetOpen] = useState(false);

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
    <>
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
              className="flex-shrink-0 w-[180px] p-3 bg-white dark:bg-[#1f2121] border border-[#E5E5E5] dark:border-[#2a2a2a] rounded-xl hover:border-[#20B8CD] dark:hover:border-[#20B8CD] transition-colors group font-ui"
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
              <p className="text-sm text-[#13343B] dark:text-[#e7e7e2] font-medium line-clamp-2 group-hover:text-[#20B8CD] transition-colors">
                {citation.title || getDomain(citation.url)}
              </p>
            </a>
          ))}

          {/* +X sources card - clickable to open sheet */}
          {remainingCount > 0 && (
            <button
              onClick={() => setSheetOpen(true)}
              className="flex-shrink-0 w-[100px] p-3 bg-[#F5F5F5] dark:bg-[#2a2a2a] border border-[#E5E5E5] dark:border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center font-ui hover:border-[#20B8CD] dark:hover:border-[#20B8CD] transition-colors cursor-pointer"
            >
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
            </button>
          )}
        </div>
      </div>

      {/* Sources Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-white dark:bg-[#1f2121] border-l border-[#E5E5E5] dark:border-[#2a2a2a] p-0 overflow-hidden"
        >
          {/* Header */}
          <SheetHeader className="sticky top-0 bg-white dark:bg-[#1f2121] border-b border-[#E5E5E5] dark:border-[#2a2a2a] px-4 py-4 z-10">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-lg font-semibold text-[#13343B] dark:text-[#e7e7e2]">
                Sources
              </SheetTitle>
              <span className="px-2 py-0.5 text-xs font-medium bg-[#F5F5F5] dark:bg-[#2a2a2a] text-[#64748B] rounded-full">
                {citations.length}
              </span>
            </div>
            <SheetDescription className="sr-only">
              List of all source citations
            </SheetDescription>
          </SheetHeader>

          {/* Sources List */}
          <div className="overflow-y-auto h-[calc(100vh-80px)] pb-8">
            {citations.map((citation, idx) => (
              <a
                key={citation.id || idx}
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-4 border-b border-[#E5E5E5] dark:border-[#2a2a2a] hover:bg-[#F8F8F7] dark:hover:bg-[#252525] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  {/* Number */}
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#F5F5F5] dark:bg-[#2a2a2a] flex items-center justify-center text-xs font-medium text-[#64748B]">
                    {idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    {/* Domain with favicon */}
                    <div className="flex items-center gap-2 mb-1">
                      <img
                        src={citation.favicon || getFaviconUrl(citation.url)}
                        alt=""
                        className="w-4 h-4 rounded-sm object-contain flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <span className="text-xs text-[#64748B] truncate">
                        {getDomain(citation.url)}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-medium text-[#13343B] dark:text-[#e7e7e2] group-hover:text-[#20B8CD] transition-colors line-clamp-2 mb-1">
                      {citation.title || getDomain(citation.url)}
                    </h3>

                    {/* Snippet if available */}
                    {citation.snippet && (
                      <p className="text-xs text-[#64748B] line-clamp-2">
                        {citation.snippet}
                      </p>
                    )}
                  </div>

                  {/* External link icon */}
                  <ExternalLink className="w-4 h-4 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                </div>
              </a>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
