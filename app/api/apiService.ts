import React from 'react';
import { getAssetPath } from '../utils';
import { Message } from '../types';
import { toast } from 'sonner';

// Character limits for context windows
const MODEL_LIMITS = {
  exa: 8000,    // Based on Exa RAG best practices
  groq: 128000, // Groq models have a much larger limit
  default: 8000 // Fallback limit
};

// Function to truncate conversation history to fit within context window
const truncateConversationHistory = (messages: Message[], modelId: string): Message[] => {
  // For Exa, just return most recent query - simpler approach to prevent timeouts
  if (modelId === 'exa') {
    // For Exa, we only need the very last user query without additional context
    const userMessages = messages.filter(msg => msg.role === 'user');
    if (userMessages.length > 0) {
      // Return only the most recent user message for search
      return [userMessages[userMessages.length - 1]];
    }
    return [];
  }
  
  // For LLMs like Groq, retain conversation history
  // Determine the character limit for the model
  let charLimit = MODEL_LIMITS.default;
  if (modelId.includes('groq') || modelId.startsWith('llama')) {
    charLimit = MODEL_LIMITS.groq;
  }
  
  // If there are fewer than 2 messages or the history fits in the limit, return all messages
  if (messages.length <= 2) {
    return messages;
  }
  
  // Calculate total character count in all messages
  const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  
  // If all messages fit within limit, return them all
  if (totalChars <= charLimit) {
    return messages;
  }
  
  // Always include the most recent message pairs (user question and assistant response)
  // and work backward in pairs to maintain context
  const result: Message[] = [];
  let usedChars = 0;
  
  // Process messages in reverse order (newest first)
  for (let i = messages.length - 1; i >= 0; i--) {
    const currentMsg = messages[i];
    const msgLength = currentMsg.content.length;
    
    // Always include the most recent messages
    if (i >= messages.length - 2) {
      result.unshift(currentMsg);
      usedChars += msgLength;
      continue;
    }
    
    // For older messages, check if we have room
    if (usedChars + msgLength <= charLimit) {
      result.unshift(currentMsg);
      usedChars += msgLength;
    } else {
      // If we can't fit any more messages, stop
      break;
    }
  }
  
  return result;
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
    const apiEndpoint = selectedModel === 'exa' 
      ? getAssetPath('/api/exaanswer')
      : getAssetPath('/api/groq');
    
    console.log(`Sending request to ${apiEndpoint} with model ${selectedModel}`);
    
    // Common request options
    const requestOptions = {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      signal: abortController.signal,
      credentials: 'include' as RequestCredentials, // Add credentials to include cookies
    };
    
    // Prepare request body based on the API
    const requestBody = selectedModel === 'exa' 
      ? { 
          // For Exa, just use the direct query without additional context
          query: input,
          // Don't include previous messages to avoid timeouts
          messages: []
        } 
      : { 
          // For Groq and other LLMs, include the full conversation history
          query: fullQuery,
          model: selectedModel, 
          messages: relevantHistory
        };
    
    // Make the fetch request
    response = await fetch(
      apiEndpoint, 
      {
        ...requestOptions,
        body: JSON.stringify(requestBody),
      }
    );

    // Check if it's JSON and parse it for error info
    if (!response.ok) {
      console.error(`API request failed with status ${response.status}`);
      
      // Special handling for authentication errors
      if (response.status === 401) {
        toast.error('Authentication required', {
          description: 'Please sign in to continue using this feature',
          duration: 5000
        });
        
        throw new Error('Authentication required. Please sign in and try again.');
      }
      
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
        
        throw new Error(errorData.error?.message || errorData.message || 'API request failed');
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
                  ? { 
                      ...msg,
                      content: content,
                      // Mark message as completed if we detect we're at the end
                      completed: line.includes('"finish_reason"') || line.includes('"done":true')
                    } 
                  : msg
              )
            );
          }
        } catch (e) {
          console.error('Error parsing chunk:', e);
        }
      }
    }

    // After streaming completes, make one final update to ensure message is marked as completed
    updateMessages(setMessages, (prev: Message[]) => 
      prev.map((msg: Message) => 
        msg.id === assistantMessage.id 
          ? { ...msg, content, citations, completed: true } 
          : msg
      )
    );

    return { content, citations };
  } catch (e) {
    console.error('Error in fetchResponse:', e);
    
    if (e instanceof Error && e.message.includes('Authentication')) {
      // This is an authentication error, show appropriate message
      throw e;
    }
    
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
    } else {
      // Generic error toast
      toast.error('Error processing request', {
        description: e instanceof Error ? e.message : 'Unknown error occurred',
        duration: 5000
      });
    }
    
    throw e;
  }
}; 