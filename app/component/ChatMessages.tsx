import React, { useMemo } from 'react';
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
  // Check if the last assistant message is completed to stop loading animation
  const lastAssistantMessageCompleted = useMemo(() => {
    // Find all assistant messages
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');
    if (assistantMessages.length === 0) return true; // If no assistant messages, consider it complete
    
    // Get the last assistant message
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
    
    // If it's explicitly marked as completed, return true
    if (lastAssistantMessage.completed) return true;
    
    // Treat empty assistant messages (not started streaming yet) as incomplete
    if (!lastAssistantMessage.content.trim()) return false;
    
    // If it's the very last message in the conversation and has content but no completed flag
    const isLastMessageInConversation = messages[messages.length - 1].id === lastAssistantMessage.id;
    
    // For backwards compatibility with messages created before the completed flag was introduced:
    // Check if it's been at least 2 seconds since isLoading was set to false, which likely means
    // the response is complete but wasn't marked as such
    return !isLoading && isLastMessageInConversation && lastAssistantMessage.content.length > 0;
  }, [messages, isLoading]);

  // Determine if we should show the loading indicator
  const shouldShowLoading = isLoading && !lastAssistantMessageCompleted;

  return (
    <div className="pt-16 pb-32 w-full overflow-x-hidden">
      <div className="w-full max-w-full md:max-w-4xl mx-auto px-4 py-6 space-y-6">
        {messages.map((message) => (
          <div key={message.id} className="w-full">
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

        {/* Loading indicator - only show when actively loading and last assistant message is not completed */}
        {shouldShowLoading && (
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