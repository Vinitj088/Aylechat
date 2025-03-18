import React from 'react';
import { getAssetPath } from '../utils';
import { Message } from '../types';

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

  if (!response.ok) throw new Error('Failed to fetch response');
  
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
}; 