'use client';

import React from 'react';

interface SystemPromptDisplayProps {
  content: string;
}

const SystemPromptDisplay: React.FC<SystemPromptDisplayProps> = ({ content }) => {
  return (
    <div className="max-w-4xl mx-auto my-6 px-4">
      <div className="relative rounded-2xl border-2 border-dashed border-gray-400 dark:border-gray-600 p-6 pt-8 font-mono">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--secondary-default)] px-3">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            system prompt
          </span>
        </div>
        <p className="text-sm text-[var(--text-light-muted)] whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
};

export default SystemPromptDisplay; 