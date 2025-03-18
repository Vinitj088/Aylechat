import React from 'react';
import { getAssetPath } from '../utils';
import { Message } from '../types';
import { toast } from 'sonner';

// Character limits for context windows
const MODEL_LIMITS = {
  exa: 10000,  // Exa has a 10k character limit
  groq: 128000, // Groq models have a much larger limit
  default: 8000 // Fallback limit
};

// Function to truncate conversation history to fit within context window
const truncateConversationHistory = (messages: Message[], modelId: string): Message[] => {
  // Determine the character limit for the model
  let charLimit = MODEL_LIMITS.default;
  if (modelId === 'exa') {
    charLimit = MODEL_LIMITS.exa;
  } else if (modelId.includes('groq') || modelId.startsWith('llama')) {
    charLimit = MODEL_LIMITS.groq;
  }
  
  // Clone the messages array to avoid mutations
  const messagesCopy = [...messages];
  let totalChars = 0;
  let startIndex = messagesCopy.length - 1;
  
  // Always include the most recent message and work backward
  // Count characters from newest to oldest
  for (let i = messagesCopy.length - 1; i >= 0; i--) {
    const msgLength = messagesCopy[i].content.length;
    if (totalChars + msgLength > charLimit) {
      // If adding this message would exceed the limit, stop here
      startIndex = i + 1;
      break;
    }
    totalChars += msgLength;
    startIndex = i; // Update the starting index
  }
  
  // Return the truncated messages
  return messagesCopy.slice(startIndex);
};

// Helper type for message updater function
type MessageUpdater = ((messages: Message[]) => void) | React.Dispatch<React.SetStateAction<Message[]>>;

// Helper function to safely update messages
const updateMessages = (
  setMessages: MessageUpdater,
  updater: (prev: Message[]) => Message[]
) => {
  if (typeof setMessages === 'function') {
    try {
      // First try it as a React setState function
      (setMessages as React.Dispatch<React.SetStateAction<Message[]>>)(updater);
    } catch (e) {
      // If that fails, try it as a custom callback function
      try {
        // For custom callback, we need to create a dummy array and apply the updater
        const dummyArray: Message[] = [];
        const updatedMessages = updater(dummyArray);
        (setMessages as (messages: Message[]) => void)(updatedMessages);
      } catch (innerE) {
        console.error('Failed to update messages:', innerE);
      }
    }
  }
};

export const fetchResponse = async (
  input: string,
  messages: Message[],
  selectedModel: string,
  abortController: AbortController,
  setMessages: MessageUpdater,
  assistantMessage: Message
) => {
  // Prepare messages for conversation history, ensuring we respect context limits
  const relevantHistory = truncateConversationHistory(messages, selectedModel);
  
  // Format previous messages into conversation history
  const conversationHistory = relevantHistory.map(msg => 
    `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
  ).join('\n');

  // Combine history with new query
  const fullQuery = conversationHistory 
    ? `${conversationHistory}\nUser: ${input}`
    : input;

  let response;
  
  try {
    if (selectedModel === 'exa') {
      // Use Exa API - send the relevant history
      response = await fetch(getAssetPath('/api/exaanswer'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: input, // Send current input as the query
          messages: relevantHistory // Send truncated message history
        }),
        signal: abortController.signal,
      });
    } else {
      // Use Groq API
      response = await fetch(getAssetPath('/api/groq'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: fullQuery,
          model: selectedModel,
          messages: relevantHistory // Add messages array for Groq
        }),
        signal: abortController.signal,
      });
    }

    // Check if it's JSON and parse it for error info
    if (!response.ok) {
      // Check content type to determine if it's JSON
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        
        if (response.status === 429) {
          // Handle rate limit error
          let waitTime = 30; // Default wait time in seconds
          let message = 'Rate limit reached. Please try again later.';
          
          if (errorData.error && errorData.error.message) {
            message = errorData.error.message;
            
            // Try to extract wait time if available
            // Look for patterns like "try again in 539ms" or "try again in 30s"
            const waitTimeMatch = message.match(/try again in (\d+\.?\d*)([ms]+)/);
            if (waitTimeMatch) {
              const timeValue = parseFloat(waitTimeMatch[1]);
              const timeUnit = waitTimeMatch[2];
              
              // Convert to seconds if it's in milliseconds
              if (timeUnit === 'ms') {
                waitTime = Math.ceil(timeValue / 1000);
              } else {
                waitTime = Math.ceil(timeValue);
              }
            }
          }
          
          // Display toast notification for rate limit
          toast.error('RATE LIMIT REACHED', {
            description: `Please wait ${waitTime} seconds before trying again.`,
            duration: 8000,
            action: {
              label: 'DISMISS',
              onClick: () => {}
            }
          });
          
          // Create a custom error with rate limit info
          const rateLimitError = new Error('Rate limit reached');
          rateLimitError.name = 'RateLimitError';
          // @ts-ignore - adding custom properties
          rateLimitError.waitTime = waitTime;
          // @ts-ignore - adding custom properties
          rateLimitError.details = message;
          
          throw rateLimitError;
        }
        
        throw new Error(errorData.error?.message || 'API request failed');
      }
      
      throw new Error(`Request failed with status ${response.status}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

    let content = '';
    let citations: any[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Convert the chunk to text
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.citations) {
            citations = data.citations;
            // Update message with new citations immediately
            updateMessages(setMessages, (prev: Message[]) => 
              prev.map((msg: Message) => 
                msg.id === assistantMessage.id 
                  ? { ...msg, citations: data.citations } 
                  : msg
              )
            );
          } else if (data.choices && data.choices[0]?.delta?.content) {
            const newContent = data.choices[0].delta.content;
            content += newContent;
            
            // Update message with new content
            updateMessages(setMessages, (prev: Message[]) => 
              prev.map((msg: Message) => 
                msg.id === assistantMessage.id 
                  ? { ...msg, content: content } 
                  : msg
              )
            );
          }
        } catch (e) {
          console.error('Error parsing chunk:', e);
        }
      }
    }

    // Final update with complete content and citations
    updateMessages(setMessages, (prev: Message[]) => 
      prev.map((msg: Message) => 
        msg.id === assistantMessage.id 
          ? { ...msg, content, citations } 
          : msg
      )
    );

    return { content, citations };
  } catch (e) {
    console.error('Error in fetchResponse:', e);
    // Make sure to show the toast one more time here in case it failed earlier
    if (e instanceof Error && e.message.includes('Rate limit')) {
      toast.error('RATE LIMIT REACHED', {
        description: 'Please wait before trying again.',
        duration: 5000,
        action: {
          label: 'DISMISS',
          onClick: () => {}
        }
      });
    }
    throw e;
  }
}; 