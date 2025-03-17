import React from 'react';
import MessageContent from './MessageContent';
import Citation from './Citation';
import { Message, Model } from '../types';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  selectedModel: string;
  selectedModelObj?: Model;
  isExa: boolean;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ 
  messages, 
  isLoading, 
  selectedModel, 
  selectedModelObj, 
  isExa 
}) => {
  return (
    <div className="pt-16 pb-32">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {messages.map((message) => (
          <div key={message.id}>
            <div
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`rounded-lg py-3 px-4 max-w-[85%] ${
                  message.role === 'user'
                    ? 'bg-[var(--secondary-darker)] rounded text-black text-base'
                    : 'text-gray-900 text-base'
                }`}
              >
                <div className="whitespace-pre-wrap text-[15px]">
                  <MessageContent content={message.content} role={message.role} />
                </div>
                {message.citations && message.citations.length > 0 && (
                  <Citation citations={message.citations} />
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-[var(--secondary-accent2x)] animate-[bounce_1s_infinite]"></div>
            <div className="w-2 h-2 rounded-full bg-[var(--secondary-accent2x)] animate-[bounce_1s_infinite_200ms]"></div>
            <div className="w-2 h-2 rounded-full bg-[var(--secondary-accent2x)] animate-[bounce_1s_infinite_400ms]"></div>
            <span className="text-sm font-medium text-[var(--secondary-accent2x)]">
              {isExa ? 'Asking Exa...' : `Using ${selectedModelObj?.name || ''}...`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessages; 