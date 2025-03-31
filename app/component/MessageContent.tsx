import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import Markdown from 'markdown-to-jsx';
// Import Starry Night
import { common, createStarryNight } from '@wooorm/starry-night';
import { toHtml } from 'hast-util-to-html';

type ParsedContent = {
  thinking: string;
  visible: string;
};

// Message content props interface
interface MessageContentProps {
  content: string;
  role: string;
}

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

// Simple inline code component
const InlineCode = ({ children }: { children: React.ReactNode }) => {
  return (
    <code className="bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 text-gray-800 dark:text-gray-200 text-sm font-mono break-words">
      {children}
    </code>
  );
};

// Map of language aliases to standard names
const languageMap: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  yml: 'yaml',
  html: 'html',
  xml: 'xml',
  svg: 'xml',
  rb: 'ruby',
  rs: 'rust',
  cs: 'csharp',
  cpp: 'cpp',
  c: 'c',
  go: 'go',
  java: 'java',
  php: 'php',
  json: 'json',
  md: 'markdown',
  sql: 'sql',
  txt: 'plaintext'
};

// Initialize Starry Night once
let starryNightInstance: any = null;
let starryNightPromise: Promise<any> | null = null;

// Initialize the starry night instance
const getStarryNight = async () => {
  if (starryNightInstance) return starryNightInstance;
  
  if (!starryNightPromise) {
    console.log('Creating new Starry Night instance with common languages');
    starryNightPromise = createStarryNight(common);
  }
  
  starryNightInstance = await starryNightPromise;
  console.log('Starry Night instance ready:', starryNightInstance);
  return starryNightInstance;
};

// Code block component with Starry Night and copy button
const CodeBlock = ({ className, children }: { className?: string; children: React.ReactNode }) => {
  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState('');
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Parse language from className - but always use cpp highlighting
  const match = /language-(\w+)/.exec(className || '');
  let language = match ? match[1] : '';
  const displayLanguage = language || 'Code'; // For display purposes only
  
  const title = displayLanguage ? displayLanguage.charAt(0).toUpperCase() + displayLanguage.slice(1) : 'Code';
  const code = String(children).trim();
  
  // Highlight code using Starry Night with C++ highlighting for all languages
  useEffect(() => {
    if (!code) return;

    const highlightCode = async () => {
      try {
        console.log(`Highlighting all code as C++ (cpp), theme: ${theme}`);
        const starryNight = await getStarryNight();
        
        // Always use C++ scope for highlighting
        let scope = '';
        try {
          scope = starryNight.flagToScope('cpp');
          console.log(`Using C++ scope for all code: ${scope}`);
        } catch (error) {
          console.log('Error with C++ scope, using plaintext');
          scope = 'source.plaintext';
        }
        
        // Highlight the code
        if (scope) {
          console.log(`Highlighting with C++ scope: ${scope}`);
          
          // Handle plaintext separately for empty code blocks
          if (!code.trim()) {
            console.log('Empty code, using plaintext formatting');
            setHighlighted('');
          } else {
            const tree = starryNight.highlight(code, scope);
            console.log('Highlight tree created');
            const html = toHtml(tree);
            console.log('HTML generated, length:', html.length);
            
            // Replace scope-source class with hljs class for consistent styling
            const processedHtml = html.replace(/class="([^"]*?)"/g, (match, classNames) => {
              const cssClass = classNames.includes('source') ? 'hljs ' + classNames : classNames;
              return `class="${cssClass}"`;
            });
            
            setHighlighted(processedHtml);
          }
        } else {
          // Fallback to plain text
          console.log('No scope available, using plain text');
          const escapedCode = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          
          setHighlighted(`<span class="source plaintext">${escapedCode}</span>`);
        }
      } catch (error) {
        console.error('Error highlighting code:', error);
        // Even if there's an error, still display the code
        const escapedCode = code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        
        setHighlighted(`<span class="source plaintext">${escapedCode}</span>`);
      }
    };
    
    highlightCode();
  }, [code, theme]);
  
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
  
  // For inline code (no language)
  if (!className) {
    return <InlineCode>{children}</InlineCode>;
  }
  
  // For code blocks with language
  return (
    <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-md mb-5 shadow-sm">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-600 dark:text-gray-300">
            <path d="M8 3H7C5.89543 3 5 3.89543 5 5V7M8 3H16M8 3V2M16 3H17C18.1046 3 19 3.89543 19 5V7M16 3V2M19 7V15M19 7H20M5 7V15M5 7H4M19 15V17C19 18.1046 18.1046 19 17 19H16M19 15H20M5 15V17C5 18.1046 5.89543 19 7 19H8M5 15H4M8 19H16M8 19V20M16 19V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
        </div>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Copied!</span>
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
      
      {/* Code content with highlighting */}
      <div 
        
        className="overflow-auto p-4 font-mono text-sm"
      >
        {highlighted ? (
          <pre className="m-0 p-0">
            <code 
              dangerouslySetInnerHTML={{ __html: highlighted }} 
              className={`language-${language} hljs`}
            />
          </pre>
        ) : (
          <pre className="m-0 p-0">
            <code className={`language-${language}`}>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
};

// Custom task list item component for rendering checkboxes in markdown
const TaskListItem = ({ checked, children }: { checked?: boolean; children: React.ReactNode }) => {
  return (
    <li className="flex items-start gap-2 mb-3">
      <div className="flex-shrink-0 mt-1">
        <div className={`w-4 h-4 border rounded ${checked 
          ? 'bg-blue-500 border-blue-500 flex items-center justify-center' 
          : 'border-gray-300 dark:border-gray-600'}`}>
          {checked && (
            <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </li>
  );
};

// Create a custom processor for the markdown content
export const processMarkdown = (content: string): string => {
  // Process task lists
  let processed = content.replace(/^(\s*)-\s*\[([ xX])\]\s*(.*?)$/gm, (_, indent, check, text) => {
    const isChecked = check.toLowerCase() === 'x';
    return `${indent}- [task:${isChecked ? 'checked' : 'unchecked'}] ${text}`;
  });
  
  // We don't need to detect languages anymore - all code will use cpp highlighting
  
  return processed;
};

// Define a wrapper for code blocks so they render properly
const PreBlock = ({ children, ...props }: any) => {
  // Check if children is a valid React element
  if (React.isValidElement(children)) {
    // Type assertion for the element
    const codeElement = children as React.ReactElement;
    
    // Check if it's a code element with a className
    if (codeElement.type === 'code') {
      // Always use cpp highlighting regardless of the language specified
      return <CodeBlock className="language-cpp">{codeElement.props.children}</CodeBlock>;
    }
  }
  
  // Otherwise, render as a regular pre element
  return (
    <pre className="p-4 bg-gray-50 dark:bg-gray-900 rounded-md mb-6 overflow-x-auto whitespace-pre-wrap" {...props}>
      {children}
    </pre>
  );
};

// Custom list item component that can render both regular list items and task list items
const ListItem = ({ children, ...props }: any) => {
  // Check if this is a task list item
  if (children && typeof children[0] === 'string') {
    const match = children[0].match(/^\[task:(checked|unchecked)\]\s(.*)/);
    if (match) {
      const isChecked = match[1] === 'checked';
      // Replace the task marker with the actual text
      const actualText = match[2];
      const otherChildren = children.slice(1);
      
      return (
        <TaskListItem checked={isChecked}>
          {actualText}
          {otherChildren}
        </TaskListItem>
      );
    }
  }
  
  // Regular list item
  return (
    <li className="mb-3" {...props}>
      {children}
    </li>
  );
};

// Define markdown rendering options with custom components
export const markdownOptions = {
  forceBlock: true,
  disableParsingRawHTML: false,
  overrides: {
    code: {
      component: CodeBlock
    },
    pre: {
      component: PreBlock
    },
    a: {
      component: ({ children, ...props }: any) => (
        <a 
          {...props} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {children}
        </a>
      )
    },
    table: {
      component: ({ children, ...props }: any) => (
        <div className="overflow-x-auto my-6 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm">
          <table className="min-w-full border-collapse bg-white dark:bg-gray-800 table-fixed" {...props}>
            {children}
          </table>
        </div>
      )
    },
    thead: {
      component: ({ children, ...props }: any) => (
        <thead className="bg-gray-50 dark:bg-gray-800" {...props}>
          {children}
        </thead>
      )
    },
    th: {
      component: ({ children, ...props }: any) => (
        <th className="border-b border-gray-200 dark:border-gray-700 px-4 py-2 text-left font-semibold bg-gray-50 dark:bg-gray-700" {...props}>
          {children}
        </th>
      )
    },
    td: {
      component: ({ children, ...props }: any) => (
        <td className="border-b border-gray-200 dark:border-gray-700 px-4 py-2" {...props}>
          {children}
        </td>
      )
    },
    ul: {
      component: ({ children, ...props }: any) => (
        <ul className="list-disc pl-6 mb-6 space-y-2" {...props}>
          {children}
        </ul>
      )
    },
    ol: {
      component: ({ children, ...props }: any) => (
        <ol className="list-decimal pl-6 mb-6 space-y-2" {...props}>
          {children}
        </ol>
      )
    },
    li: {
      component: ListItem
    },
    blockquote: {
      component: ({ children, ...props }: any) => (
        <blockquote className="border-l-4 border-gray-200 dark:border-gray-700 pl-4 italic my-6 text-gray-700 dark:text-gray-300" {...props}>
          {children}
        </blockquote>
      )
    },
    h1: {
      component: ({ children, ...props }: any) => (
        <h1 className="text-2xl font-bold mt-8 mb-4" {...props}>
          {children}
        </h1>
      )
    },
    h2: {
      component: ({ children, ...props }: any) => (
        <h2 className="text-xl font-bold mt-7 mb-3" {...props}>
          {children}
        </h2>
      )
    },
    h3: {
      component: ({ children, ...props }: any) => (
        <h3 className="text-lg font-bold mt-6 mb-3" {...props}>
          {children}
        </h3>
      )
    },
    h4: {
      component: ({ children, ...props }: any) => (
        <h4 className="text-base font-bold mt-5 mb-2" {...props}>
          {children}
        </h4>
      )
    },
    h5: {
      component: ({ children, ...props }: any) => (
        <h5 className="text-sm font-bold mt-4 mb-2" {...props}>
          {children}
        </h5>
      )
    },
    h6: {
      component: ({ children, ...props }: any) => (
        <h6 className="text-xs font-bold mt-3 mb-2" {...props}>
          {children}
        </h6>
      )
    },
    p: {
      component: ({ children, ...props }: any) => (
        <p className="mb-6 leading-relaxed" {...props}>
          {children}
        </p>
      )
    },
    hr: {
      component: ({ ...props }: any) => (
        <hr className="my-6 border-t border-gray-200 dark:border-gray-700" {...props} />
      )
    },
    img: {
      component: ({ src, alt, ...props }: any) => (
        <img 
          src={src} 
          alt={alt || ''} 
          className="max-w-full h-auto my-5 rounded-md shadow-sm"
          {...props}
        />
      )
    }
  }
};

export default function MessageContent({ content, role }: MessageContentProps) {
  const { thinking, visible } = parseMessageContent(content || '');
  const [copied, setCopied] = useState(false);

  // Function to copy text to clipboard
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

  // Process the markdown content for task lists
  const processedContent = processMarkdown(visible);

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
      
      {visible && (
        <div className="markdown-content prose prose-base max-w-none dark:prose-invert overflow-hidden">
          <Markdown options={markdownOptions}>{processedContent}</Markdown>
        </div>
      )}
      
      {/* Copy button at bottom - restored as requested */}
      {role === 'assistant' && visible && (
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