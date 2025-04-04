import React, { useEffect, useRef, useState, memo } from 'react';
// import { Message, Model } from "../types"; // Use UIMessage instead
import { Model } from "../types"; // Keep Model type
import { type Message as UIMessage } from '@ai-sdk/react'; // Import UIMessage

// Import prompt-kit components
import { Message } from '@/components/ui/message';
import { Loader } from '@/components/ui/loader';
// Import the Markdown component from prompt-kit (or shadcn/ui)
import { Markdown } from '@/components/ui/markdown';

interface ChatMessagesProps {
  messages: UIMessage[]; // Use UIMessage[]
  isLoading: boolean;
  // Remove props no longer needed by this simplified component
  // selectedModel: string;
  // selectedModelObj?: Model;
  // isExa: boolean;
}

const ChatMessages = memo(function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messageCount, setMessageCount] = useState(0);
  // Remove unused useParams and threadId
  // const params = useParams();
  // const threadId = params?.threadId as string;
  
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

  return (
    <div className="pt-16 pb-32 w-full overflow-x-hidden">
      <div className="w-full max-w-full md:max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Map messages directly to prompt-kit Message */}
        {messages.map(m => (
          <Message key={m.id} role={m.role}>
              {/* Render content using the Markdown component as children */}
              <Markdown>{m.content}</Markdown>
          </Message>
        ))}

        {/* Use prompt-kit Loader */}
        {isLoading && (
           <div className="flex justify-center items-center p-4">
              <Loader />
           </div>
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