import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Add the parseMessageContent helper function
const parseMessageContent = (content: string) => {
  // If we find a complete think tag
  if (content.includes('</think>')) {
    const [thinking, ...rest] = content.split('</think>');
    return {
      thinking: thinking.replace('<think>', '').trim(),
      finalResponse: rest.join('</think>').trim(),
      isComplete: true
    };
  }
  // If we only find opening think tag, everything after it is thinking
  if (content.includes('<think>')) {
    return {
      thinking: content.replace('<think>', '').trim(),
      finalResponse: '',
      isComplete: false
    };
  }
  // No think tags, everything is final response
  return {
    thinking: '',
    finalResponse: content,
    isComplete: true
  };
};

interface MessageContentProps {
  content: string;
}

export default function MessageContent({ content }: MessageContentProps) {
  const { thinking, finalResponse, isComplete } = parseMessageContent(content);

  return (
    <>
      {(thinking || !isComplete) && (
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
      {isComplete && finalResponse && (
        <div className="prose prose-base max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{finalResponse}</ReactMarkdown>
        </div>
      )}
    </>
  );
} 