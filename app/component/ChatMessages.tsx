import React, { useEffect, useRef, useState, memo } from 'react';
import { Message } from "../types";
import MessageContent from './MessageContent';
import Citation from './Citation';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  selectedModel: string;
  selectedModelObj?: any;
  isExa: boolean;
}

// Memoized message component to prevent unnecessary re-renders
const ChatMessage = memo(({ message, isUser }: { message: Message, isUser: boolean }) => (
  <div className="w-full">
    <div
      className={`flex ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`rounded-lg py-3 px-4 max-w-[85%] ${
          isUser
            ? 'bg-[var(--secondary-darker)] rounded text-black text-base'
            : 'bg-white border border-[var(--secondary-darkest)] rounded-lg text-gray-900 text-base'
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
));

// Loading indicator component
const LoadingIndicator = memo(({ isExa, modelName }: { isExa: boolean, modelName: string }) => (
  <div className="flex items-center gap-2 text-gray-500 animate-pulse">
    <div className="w-2 h-2 rounded-full bg-[var(--brand-default)] animate-[bounce_1s_infinite]"></div>
    <div className="w-2 h-2 rounded-full bg-[var(--brand-default)] animate-[bounce_1s_infinite_200ms]"></div>
    <div className="w-2 h-2 rounded-full bg-[var(--brand-default)] animate-[bounce_1s_infinite_400ms]"></div>
    <span className="text-sm font-medium text-[var(--brand-dark)]">
      {isExa ? 'Asking Exa...' : `Using ${modelName || ''}...`}
    </span>
  </div>
));

const ChatMessages: React.FC<ChatMessagesProps> = ({ 
  messages,
  isLoading,
  selectedModel,
  selectedModelObj,
  isExa
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messageCount, setMessageCount] = useState(0);
  
  // Track message count to only scroll when new messages are added
  useEffect(() => {
    if (messages.length !== messageCount) {
      setMessageCount(messages.length);
      
      // Scroll to bottom only when a new message is added
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages.length, messageCount]);
  
  // Scroll when loading state changes from false to true
  useEffect(() => {
    if (isLoading) {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [isLoading]);

  // Get the model name for display
  const modelName = selectedModelObj?.name || '';

  return (
    <div className="pt-16 pb-32 w-full overflow-x-hidden">
      <div className="w-full max-w-full md:max-w-4xl mx-auto px-4 py-6 space-y-6">
        {messages.map((message) => (
          <ChatMessage 
            key={message.id} 
            message={message} 
            isUser={message.role === 'user'} 
          />
        ))}
        
        {isLoading && (
          <LoadingIndicator isExa={isExa} modelName={modelName} />
        )}
        
        {/* Empty div for auto-scrolling to bottom */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default React.memo(ChatMessages); 