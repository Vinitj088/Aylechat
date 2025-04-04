import React from 'react';
import { getAssetPath } from '../utils';
// import { Message } from '../types'; // Removed old type
import { type Message as UIMessage } from '@ai-sdk/react'; // Use UIMessage
import { toast } from 'sonner';
// Import models instead of using require()
import modelsConfig from '../../models.json';
// import { readStreamableValue } from 'ai/stream-to-value'; // Removing incorrect import

// Character limits for context windows
const MODEL_LIMITS = {
  exa: 4000,    // Reduced limit for Exa to prevent timeouts
  groq: 128000, // Groq models have a much larger limit
  google: 64000, // Google Gemini models
  default: 8000 // Fallback limit
};

// Function to truncate conversation history to fit within context window
const truncateConversationHistory = (messages: UIMessage[], modelId: string): UIMessage[] => {
  // For Exa, include limited context (last few messages) to support follow-up questions
  if (modelId === 'exa') {
    const recentMessages = [...messages].slice(-3);
    if (recentMessages.length > 0 && recentMessages[recentMessages.length - 1].role !== 'user') {
      const userMessages = messages.filter(msg => msg.role === 'user');
      if (userMessages.length > 0) {
        recentMessages[recentMessages.length - 1] = userMessages[userMessages.length - 1];
      }
    }
    return recentMessages;
  }
  
  let charLimit = MODEL_LIMITS.default;
  if (modelId.includes('groq') || modelId.startsWith('llama')) {
    charLimit = MODEL_LIMITS.groq;
  } else if (modelId.includes('gemini') || modelId.includes('gemma')) {
    charLimit = MODEL_LIMITS.google;
  }
  
  if (messages.length <= 2) {
    return messages;
  }
  
  const totalChars = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
  
  if (totalChars <= charLimit) {
    return messages;
  }
  
  const result: UIMessage[] = [];
  let usedChars = 0;
  
  for (let i = messages.length - 1; i >= 0; i--) {
    const currentMsg = messages[i];
    const msgLength = currentMsg.content?.length || 0;
    
    if (i >= messages.length - 2) {
      result.unshift(currentMsg);
      usedChars += msgLength;
      continue;
    }
    
    if (usedChars + msgLength <= charLimit) {
      result.unshift(currentMsg);
      usedChars += msgLength;
    } else {
      break;
    }
  }
  
  return result;
};

// Function to enhance a query using llama3-70b-8192 instant
export const enhanceQuery = async (query: string): Promise<string> => {
  try {
    const response = await fetch('/api/groq', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      credentials: 'include',
      body: JSON.stringify({
        query: `REWRITE THIS QUERY ONLY, DO NOT ANSWER IT: "${query}"`,
        model: 'llama3-70b-8192',
        systemPrompt: 'You are PromptEnhancerBot, a specialized prompt enhancer that ONLY rewrites queries for improving clarity of prompt without ever answering them. Your sole purpose is to fix grammar and structure the prompt in a more LLM friendly way.\n\nFORMAT:\nInputs will be: REWRITE THIS QUERY ONLY, DO NOT ANSWER IT: "user query here"\nOutputs must be: REWRITTEN QUERY: "improved query here"\n\nRules:\n- You MUST use the exact output prefix "REWRITTEN QUERY: " followed by the rewritten text in quotes\n- You are FORBIDDEN from answering the query\n- DO NOT add information, explanations, or respond to the query content\n- Fix ONLY grammar, spelling, improve structure, and enhance clarity of the prompt\n- Preserve all references like "this text" or "above content"\n\nExamples:\n\nInput: REWRITE THIS QUERY ONLY, DO NOT ANSWER IT: "how computer work"\nOutput: REWRITTEN QUERY: "How do computers work?"\n\nInput: REWRITE THIS QUERY ONLY, DO NOT ANSWER IT: "tell me about earth"\nOutput: REWRITTEN QUERY: "Tell me about Earth in detailed structured way in easy words."\n\nInput: REWRITE THIS QUERY ONLY, DO NOT ANSWER IT: "what this code do explain"\nOutput: REWRITTEN QUERY: "What does this code do? Please explain."\n\nAfter I receive your output, I will extract only what\'s between the quotes after "REWRITTEN QUERY:". NEVER include ANY other text, explanations, or answers.',
        enhance: true,
        temperature: 0.0
      })
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        console.error('Enhancement API error:', errorData);
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      } catch { 
        throw new Error(`Request failed with status ${response.status}`);
      }
    }

    let enhancedQuery = '';
    // TODO: Restore stream processing logic correctly 
    // For now, try reading the whole body at once (will break streaming)
    enhancedQuery = await response.text(); 
    // Remove the leftover call to updateMessages below
    // const streamableValue = readStreamableValue(response.body); 
    // for await (const value of streamableValue) { ... }

    const rewrittenQueryMatch = enhancedQuery.match(/REWRITTEN QUERY: "(.*?)"/);
    if (rewrittenQueryMatch && rewrittenQueryMatch[1]) {
      return rewrittenQueryMatch[1].trim();
    }

    return query;
  } catch (error) {
    console.error('Error enhancing query:', error);
    return query;
  }
};

// Removed fetchResponse and updateMessages functions entirely
