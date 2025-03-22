import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import 'katex/dist/katex.min.css';

// Add the parseMessageContent helper function
const parseMessageContent = (content: string) => {
  // Check if content is undefined or null
  if (!content) {
    return { thinking: '', visible: '' };
  }
  
  // If we find a complete think tag
  if (content.includes('</think>')) {
    const [thinking, ...rest] = content.split('</think>');
    return {
      thinking: thinking.replace('<think>', '').trim(),
      visible: rest.join('</think>').trim()
    };
  }
  
  // If only opening think tag is found (incomplete thinking)
  if (content.includes('<think>')) {
    return {
      thinking: content.replace('<think>', '').trim(),
      visible: ''
    };
  }
  
  // No thinking tags
  return {
    thinking: '',
    visible: content
  };
};

// Helper function to normalize markdown content
const normalizeMarkdown = (content: string): string => {
  if (!content) return '';
  
  return content
    // Fix code blocks with missing language or extra spaces
    .replace(/```\s*([a-zA-Z0-9]*)\s*\n/g, '```$1\n')
    // Fix lists with incorrect spacing
    .replace(/^\s*[-*+]\s+/gm, '- ')
    // Fix for inconsistent table formatting
    .replace(/\|\s+/g, '| ')
    .replace(/\s+\|/g, ' |')
    // Fix for broken inline code
    .replace(/`([^`]+)`/g, '`$1`')
    // Remove unnecessary escaping of characters
    .replace(/\\([#_*])/g, '$1');
};

interface MessageContentProps {
  content: string;
  role: string;
}

// Types for React-Markdown components
interface CodeProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

interface TableProps {
  node?: any;
  children?: React.ReactNode;
  [key: string]: any;
}

// Memoized code component to prevent re-renders
const CodeBlock = React.memo(({inline, className, children, ...props}: CodeProps) => {
  const match = /language-(\w+)/.exec(className || '');
  return !inline && match ? (
    <SyntaxHighlighter
      style={atomDark}
      language={match[1]}
      PreTag="div"
      {...props}
    >
      {String(children).replace(/\n$/, '')}
    </SyntaxHighlighter>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
});

export default function MessageContent({ content, role }: MessageContentProps) {
  const { thinking, visible } = parseMessageContent(content || '');
  const [copied, setCopied] = useState(false);
  
  // Use useMemo to only recompute when content changes
  const normalizedContent = useMemo(() => normalizeMarkdown(visible), [visible]);
  
  // Memoize the markdown components
  const markdownComponents = useMemo(() => ({
    code: CodeBlock,
    table({node, ...props}: TableProps) {
      return (
        <div className="overflow-x-auto">
          <table className="border-collapse border border-gray-300" {...props} />
        </div>
      );
    },
    th({node, ...props}: TableProps) {
      return <th className="border border-gray-300 px-4 py-2 bg-gray-100" {...props} />;
    },
    td({node, ...props}: TableProps) {
      return <td className="border border-gray-300 px-4 py-2" {...props} />;
    }
  }), []);
  
  // Check if this is an AI response with actual content to copy
  const isAIResponse = role === 'assistant';
  const hasContent = normalizedContent;
  const showCopyButton = isAIResponse && hasContent;
  
  // Check if this is an error message - with null check
  const isErrorMessage = content ? (
    content.includes('Sorry, there was an error') || 
    content.includes('error processing your request')
  ) : false;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };

  return (
    <div className="relative">
      {thinking && (
        <div className="my-6 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="text-sm font-medium">Thinking</h3>
          </div>
          <div className="pl-4 relative">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200"></div>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">{thinking}</div>
          </div>
        </div>
      )}
      {normalizedContent && (
        <div className="prose prose-base max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeKatex]}
            components={markdownComponents}
          >
            {normalizedContent}
          </ReactMarkdown>
        </div>
      )}
      
      {/* Copy button below content - only shown for AI responses with content */}
      {showCopyButton && !isErrorMessage && (
        <div className="flex justify-end mt-4">
          <button
            onClick={() => copyToClipboard(normalizedContent)}
            className="flex items-center gap-1 py-1 px-2 text-xs bg-[var(--secondary-darker)] border-2 border-black rounded hover:bg-[var(--secondary-darkest)] transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}