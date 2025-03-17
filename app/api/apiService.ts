import React from 'react';
import { getAssetPath } from '../utils';
import { Message } from '../types';

export const fetchResponse = async (
  input: string,
  messages: Message[],
  selectedModel: string,
  abortController: AbortController,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  assistantMessage: Message
) => {
  // Format previous messages into conversation history
  const conversationHistory = messages.map(msg => 
    `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
  ).join('\n');

  // Combine history with new query
  const fullQuery = conversationHistory 
    ? `${conversationHistory}\nUser: ${input}`
    : input;

  let response;
  
  if (selectedModel === 'exa') {
    // Use Exa API - send the messages array instead of the full conversation history
    response = await fetch(getAssetPath('/api/exaanswer'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: input, // Send just the current input as the query
        messages: messages // Send the full messages array
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
        model: selectedModel
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
          setMessages((prev: Message[]) => 
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
          setMessages((prev: Message[]) => 
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
  setMessages((prev: Message[]) => 
    prev.map((msg: Message) => 
      msg.id === assistantMessage.id 
        ? { ...msg, content, citations } 
        : msg
    )
  );

  return { content, citations };
}; 