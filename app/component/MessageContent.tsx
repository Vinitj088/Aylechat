import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useTheme } from 'next-themes';
import 'katex/dist/katex.min.css';

type ParsedContent = {
  thinking: string;
  visible: string;
};

// Add the parseMessageContent helper function
const parseMessageContent = (content: string): ParsedContent => {
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

// Type for a segment of content
type ContentSegment = {
  type: 'text' | 'table';
  content: string;
};

// Function to split content into text and table segments
const splitContentByTables = (content: string): ContentSegment[] => {
  if (!content) return [];
  
  const segments: ContentSegment[] = [];
  // Split by table markdown pattern
  const tableRegex = /^\s*\|(.+\|)+\s*\n\s*\|(\s*[-:]+\s*\|)(\s*[-:]+\s*\|)+\s*\n(\s*\|(.+\|)+\s*\n)+/gm;
  
  let lastIndex = 0;
  let match;
  
  while ((match = tableRegex.exec(content)) !== null) {
    // Add text before table
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: content.substring(lastIndex, match.index)
      });
    }
    
    // Add table
    segments.push({
      type: 'table',
      content: match[0]
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      content: content.substring(lastIndex)
    });
  }
  
  return segments;
};

// Convert markdown table to HTML table
const convertMarkdownTableToHTML = (tableMarkdown: string): JSX.Element => {
  const lines = tableMarkdown.trim().split('\n');
  if (lines.length < 3) return <></>;
  
  // Process markdown in cell text (currently just bold)
  const processMarkdownInCell = (text: string): React.ReactNode => {
    // Handle bold text with ** or __ patterns
    const boldRegex = /(\*\*|__)(.*?)\1/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      // Add the bold text
      parts.push(<strong key={match.index}>{match[2]}</strong>);
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add any remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length ? parts : text;
  };
  
  // Extract header row
  const headerCells = lines[0]
    .trim()
    .split('|')
    .filter(cell => cell.trim() !== '')
    .map(cell => cell.trim());
  
  // Skip separator row (line 1)
  
  // Extract data rows
  const dataRows = lines.slice(2).map(line => 
    line
      .trim()
      .split('|')
      .filter(cell => cell.trim() !== '')
      .map(cell => cell.trim())
  );
  
  return (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700">
        <thead className="bg-gray-100 dark:bg-gray-800">
          <tr>
            {headerCells.map((cell, index) => (
              <th key={index} className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left font-semibold">
                {processMarkdownInCell(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                  {processMarkdownInCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface MessageContentProps {
  content: string;
  role: string;
}

// Types for React-Markdown components
interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

// Memoized code component to prevent re-renders
const CodeBlock = React.memo(({ inline, className, children, ...props }: CodeProps) => {
  const match = /language-(\w+)/.exec(className || '');
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, '');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };
  
  const language = match ? match[1] : '';
  const title = language ? language.charAt(0).toUpperCase() + language.slice(1) : 'Code';

  return !inline && match ? (
    <div className="overflow-hidden border border-gray-300 dark:border-[#333] mb-4 bg-gray-100 dark:bg-[#1E1E1E]">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-200 dark:bg-[#2D2D2D] border-b border-gray-300 dark:border-[#333]">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-600 dark:text-[#AAAAAA]">
            <path d="M8 3H7C5.89543 3 5 3.89543 5 5V7M8 3H16M8 3V2M16 3H17C18.1046 3 19 3.89543 19 5V7M16 3V2M19 7V15M19 7H20M5 7V15M5 7H4M19 15V17C19 18.1046 18.1046 19 17 19H16M19 15H20M5 15V17C5 18.1046 5.89543 19 7 19H8M5 15H4M8 19H16M8 19V20M16 19V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="text-sm font-medium text-gray-700 dark:text-[#AAAAAA]">{title} Implementation</span>
        </div>
        <div className="flex items-center">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 dark:text-[#AAAAAA] dark:hover:text-white transition-colors"
            title="Copy code"
          >
            {copied ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Done</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className="flex text-sm">
        <div className="py-4 pl-4 pr-2 text-right select-none bg-gray-200 dark:bg-[#252525] text-gray-500 dark:text-[#666] border-r border-gray-300 dark:border-[#333] min-w-[48px]">
          {code.split('\n').map((_, i) => (
            <div key={i} className="leading-relaxed">
              {i + 1}
            </div>
          ))}
        </div>
        <div className="p-4 overflow-auto w-full bg-gray-100 dark:bg-[#131313]">
          <SyntaxHighlighter
            style={isDark ? atomDark : oneLight}
            language={match[1]}
            PreTag="div"
            showLineNumbers={false}
            customStyle={{
              margin: 0,
              padding: 0,
              background: 'transparent',
              fontSize: '14px',
              lineHeight: '1.5',
            }}
            codeTagProps={{
              style: {
                fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
              }
            }}
            {...props}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  ) : (
    <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-gray-800 dark:text-gray-200 text-sm font-mono" {...props}>
      {children}
    </code>
  );
});

// Add display name
CodeBlock.displayName = 'CodeBlock';

export default function MessageContent({ content, role }: MessageContentProps) {
  const { thinking, visible } = parseMessageContent(content || '');
  const [copied, setCopied] = useState(false);
  
  // Process content into segments
  const contentSegments = useMemo(() => 
    splitContentByTables(visible), 
  [visible]);
  
  // Check if this is an AI response with actual content to copy
  const isAIResponse = role === 'assistant';
  const hasContent = visible && visible.length > 0;
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
  
  // Memoize the markdown components
  const markdownComponents = useMemo(() => ({
    code: CodeBlock as any,
    pre: ({ children, ...props }: any) => (
      <pre className="!bg-transparent !border-0 !p-0 !m-0" {...props}>
        {children}
      </pre>
    )
  }), []);

  return (
    <div className="relative">
      {thinking && (
        <div className="my-6 space-y-3">
          <div className="flex items-center gap-2 text-[var(--text-light-default)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="text-sm font-medium">Thinking</h3>
          </div>
          <div className="pl-4 relative">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--secondary-darkest)]"></div>
            <div className="text-sm text-[var(--text-light-muted)] whitespace-pre-wrap">{thinking}</div>
          </div>
        </div>
      )}
      
      {contentSegments.length > 0 && (
        <div className="prose prose-base max-w-none dark:prose-invert [&_.markdown-body]:!bg-transparent [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_pre]:!border-0">
          {contentSegments.map((segment, index) => (
            <React.Fragment key={index}>
              {segment.type === 'text' ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeKatex]}
                  components={markdownComponents}
                >
                  {segment.content}
                </ReactMarkdown>
              ) : (
                convertMarkdownTableToHTML(segment.content)
              )}
            </React.Fragment>
          ))}
        </div>
      )}
      
      {/* Copy button below content - only shown for AI responses with content */}
      {showCopyButton && !isErrorMessage && (
        <div className="flex justify-end mt-4">
          <button
            onClick={() => copyToClipboard(visible)}
            className="flex items-center gap-1 py-1 px-2 text-xs bg-[var(--secondary-darker)] text-[var(--text-light-default)] border border-[var(--secondary-darkest)] rounded hover:bg-[var(--secondary-dark)] transition-colors"
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