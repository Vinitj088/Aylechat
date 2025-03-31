import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { Message, Model } from "../types";
import MessageContent from './MessageContent';
import Citation from './Citation';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  selectedModel: string;
  selectedModelObj?: Model;
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
            ? 'bg-[var(--secondary-darker)] rounded text-[var(--text-light-default)] text-base message-human'
            : 'bg-white dark:bg-[var(--secondary-faint)] border border-[var(--secondary-darkest)] rounded-lg text-[var(--text-light-default)] text-base message-ai'
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

// Add display name to the component
ChatMessage.displayName = 'ChatMessage';

// Loading indicator component
const LoadingIndicator = memo(({ isExa, modelName }: { isExa: boolean, modelName: string }) => (
  <div className="flex items-center gap-2 text-[var(--text-light-muted)] animate-pulse">
    <div className="w-2 h-2 rounded-full bg-[var(--brand-default)] animate-[bounce_1s_infinite]"></div>
    <div className="w-2 h-2 rounded-full bg-[var(--brand-default)] animate-[bounce_1s_infinite_200ms]"></div>
    <div className="w-2 h-2 rounded-full bg-[var(--brand-default)] animate-[bounce_1s_infinite_400ms]"></div>
    <span className="text-sm font-medium text-[var(--brand-dark)]">
      {isExa ? 'Asking Exa...' : `Using ${modelName || ''}...`}
    </span>
  </div>
));

// Add display name to the component
LoadingIndicator.displayName = 'LoadingIndicator';

const ChatMessages = memo(function ChatMessages({ 
  messages, 
  isLoading, 
  selectedModel,
  selectedModelObj,
  isExa 
}: ChatMessagesProps) {
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
  const modelName = selectedModelObj?.name as string || '';

  const renderMessage = useCallback((message: Message) => {
    return (
      <ChatMessage 
        key={message.id} 
        message={message} 
        isUser={message.role === 'user'} 
      />
    );
  }, []);

  return (
    <div className="pt-16 pb-32 w-full overflow-x-hidden">
      <div className="w-full max-w-full md:max-w-4xl mx-auto px-4 py-6 space-y-6">
        {messages.map(renderMessage)}
        
        {isLoading && (
          <LoadingIndicator isExa={isExa} modelName={modelName} />
        )}
        
        {/* Empty div for auto-scrolling to bottom */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
});

// Add display name to the main component
ChatMessages.displayName = 'ChatMessages';

export default ChatMessages; 