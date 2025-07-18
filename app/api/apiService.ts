import React from 'react';
import { getAssetPath } from '../utils';
import { Message } from '../types';
import { toast } from 'sonner';
// Import models instead of using require()
import modelsConfig from '../../models.json';
import { availableTools, Tool } from '../tools';

// --- Add URL Regex ---
// Basic regex to find potential URLs. Can be refined for more complex cases.
const URL_REGEX = /(https?:\/\/[^\s]+)/g;
// --- End Add ---

// Character limits for context windows
const MODEL_LIMITS = {
  exa: 4000,    // Reduced limit for Exa to prevent timeouts
  groq: 128000, // Groq models have a much larger limit
  google: 64000, // Google Gemini models
  default: 8000 // Fallback limit
};

// Phase 4: Define K for buffer memory (number of message PAIRS)
const K_MESSAGE_PAIRS = 5; // Retain last 5 user/assistant pairs (10 messages total)

// Function to truncate conversation history to fit within context window
const truncateConversationHistory = (messages: Message[], modelId: string): Message[] => {
  // For Exa, include limited context (last few messages) to support follow-up questions
  if (modelId === 'exa') {
    // Get the last 3 messages (or fewer if there aren't that many)
    // This provides enough context for follow-ups without being too much
    const recentMessages = [...messages].slice(-3);
    
    // Make sure the last message is always included (should be a user message)
    if (recentMessages.length > 0 && recentMessages[recentMessages.length - 1].role !== 'user') {
      // If the last message isn't from the user, find the last user message
      const userMessages = messages.filter(msg => msg.role === 'user');
      if (userMessages.length > 0) {
        // Replace the last message with the most recent user message
        recentMessages[recentMessages.length - 1] = userMessages[userMessages.length - 1];
      }
    }
    
    return recentMessages;
  }
  
  // Phase 4: K-Window Buffer Memory for LLMs (Groq, Gemini, etc.)
  const maxMessages = K_MESSAGE_PAIRS * 2;

  // If the total number of messages is already within the limit, return them all
  if (messages.length <= maxMessages) {
    return messages;
  }
  
  // Otherwise, return only the last `maxMessages` messages
  console.log(`Truncating history from ${messages.length} to ${maxMessages} messages (K=${K_MESSAGE_PAIRS}).`);
  return messages.slice(-maxMessages);
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
    } catch (_error) {
      // If that fails, try it as a custom callback function
      // _error is intentionally ignored as we're falling back to another method
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

// --- Tool Calling Analysis Function ---
async function analyzeQueryForTools(query: string, messages: Message[]): Promise<{ command: string; query: string; text: string; } | null> {
  const model = 'llama-3.1-8b-instant'; // A fast model is good for this
  const toolsString = availableTools.map(t => `- ${t.command} - ${t.description}`).join('\n');
  
  // Format previous messages to provide context
  const history = messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n');

  const systemPrompt = `You are an expert AI assistant that analyzes a user's query and conversation history to determine if the query can be better answered using one of the available tools. Your primary goal is to distinguish between requests for **real-time, specific data** (which tools can provide) and **general knowledge questions** (which you should answer directly).

Your task is to respond with a JSON object. The JSON object should have one of two formats:
1. If a tool is applicable for real-time data: {"tool": "/command_name", "query": "argument for the command", "text": "Short phrase for a button, e.g., 'Get Weather'"}
2. If no tool is applicable (i.e., it's a general knowledge question): {"tool": null}

Available Tools:
${toolsString}

Conversation History (for context):
---
${history}
---

Rules:
- **Crucial Rule**: Use the conversation history to resolve pronouns or ambiguous references (e.g., "there," "that movie").
- **CRITICAL**: You MUST only use a tool command from the "Available Tools" list. If no tool in the list is appropriate, you MUST respond with {"tool": null}. Do NOT invent a tool.
- Only use a tool if the user is asking for specific, current information. For example, use the weather tool for "what is the weather *right now* in Paris?", but NOT for "is Paris *usually* cold in winter?". The latter is a general knowledge question.
- ONLY respond with the JSON object. Do not include any other text, explanations, or markdown.
- If the user's question is general, conceptual, historical, or a statement to be verified, respond with {"tool": null}.

Examples:
User Query: "what is the weather like in london?"
Response: {"tool": "/weather", "query": "london", "text": "Get Weather for London"}

User Query (after a conversation about Paris): "what about there?"
Response: {"tool": "/weather", "query": "paris", "text": "Get Weather for Paris"}

User Query: "weather all around the year in paris is snowy, isnt it?"
Response: {"tool": null}
`;

  try {
    const response = await fetch('/api/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        model: model,
        systemPrompt: systemPrompt,
        stream: false, // We need a single JSON response, not a stream
        temperature: 0.0,
      }),
    });

    if (!response.ok) {
      console.error('Tool analysis API call failed:', response.status);
      return null;
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      console.error('Tool analysis returned no content.');
      return null;
    }

    // Extract the JSON object from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Tool analysis response was not valid JSON:', content);
      return null;
    }

    const toolJson = JSON.parse(jsonMatch[0]);

    if (toolJson.tool && toolJson.query && toolJson.text) {
      // Validate that the tool is one of the available tools
      const isToolValid = availableTools.some(t => t.command === toolJson.tool);
      if (isToolValid) {
        console.log('Tool suggestion analysis result:', toolJson);
        return { command: toolJson.tool, query: toolJson.query, text: toolJson.text };
      } else {
        console.warn(`Model suggested an unavailable tool: '${toolJson.tool}'. Ignoring suggestion.`);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error('Error during tool analysis:', error);
    return null;
  }
}
// --- End Tool Calling Analysis ---

// High-quality system prompt for the main assistant
const ASSISTANT_SYSTEM_PROMPT = `
You are an expert AI coding assistant. Your responses must be clear, concise, and highly informative. When providing answers, always use high-quality Markdown with proper tags and formatting, including:

- Headings (#, ##, etc.) for structure
- Lists (ordered/unordered) for steps or options
- Code blocks (with language specified) for all code, commands, or config
- Tables for comparisons or structured data
- Blockquotes for highlighting important notes or warnings
- Bold/italic for emphasis where appropriate

Instructions:
- Always use semantic Markdown structure for readability.
- Ensure all code is properly formatted and syntax-highlighted.
- Provide explanations and context for your answers.
- Include examples where helpful.
- Suggest best practices and modern conventions.
- Point out potential improvements or alternatives if relevant.
- Avoid unnecessary verbosity or filler.
- For long answers, provide a brief summary or TL;DR at the end.

If the user's question is ambiguous, ask clarifying questions before answering.
`;

// Function to enhance a query using llama-3.3-70b-versatile instant
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
        model: 'llama-3.3-70b-versatile', // Using the more powerful 70B parameter LLaMA model
        systemPrompt: 'You are PromptEnhancerBot, a specialized prompt enhancer that ONLY rewrites queries for improving clarity of prompt without ever answering them. Your sole purpose is to fix grammar and structure the prompt in a more LLM friendly way.\n\nFORMAT:\nInputs will be: REWRITE THIS QUERY ONLY, DO NOT ANSWER IT: "user query here"\nOutputs must be: REWRITTEN QUERY: "improved query here"\n\nRules:\n- You MUST use the exact output prefix "REWRITTEN QUERY: " followed by the rewritten text in quotes\n- You are FORBIDDEN from answering the query\n- DO NOT add information, explanations, or respond to the query content\n- Fix ONLY grammar, spelling, improve structure, and enhance clarity of the prompt\n- Preserve all references like "this text" or "above content"\n\nExamples:\n\nInput: REWRITE THIS QUERY ONLY, DO NOT ANSWER IT: "how computer work"\nOutput: REWRITTEN QUERY: "How do computers work?"\n\nInput: REWRITE THIS QUERY ONLY, DO NOT ANSWER IT: "tell me about earth"\nOutput: REWRITTEN QUERY: "Tell me about Earth in detailed structured way in easy words."\n\nInput: REWRITE THIS QUERY ONLY, DO NOT ANSWER IT: "what this code do explain"\nOutput: REWRITTEN QUERY: "What does this code do? Please explain."\n\nAfter I receive your output, I will extract only what\'s between the quotes after "REWRITTEN QUERY:". NEVER include ANY other text, explanations, or answers.',
        enhance: true,
        temperature: 0.0
      })
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

    let enhancedQuery = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Convert the chunk to text
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.choices && data.choices[0]?.delta?.content) {
            enhancedQuery += data.choices[0].delta.content;
          }
        } catch (e) {
          // Silently ignore parsing errors and continue
          continue;
        }
      }
    }

    // Post-process the response to extract only the rewritten query
    const rewrittenQueryMatch = enhancedQuery.match(/REWRITTEN QUERY: "(.*?)"/);
    if (rewrittenQueryMatch && rewrittenQueryMatch[1]) {
      return rewrittenQueryMatch[1].trim();
    }

    // If the expected format isn't found, return the original query
    return query;
  } catch (error) {
    console.error('Error enhancing query:', error);
    // Return the original query if enhancement fails
    return query;
  }
};

// --- Add function to call backend scraper ---
// Updated to handle hybrid caching (instantdb validity + localStorage content)
const scrapeUrlContent = async (url: string, abortController: AbortController): Promise<string | null> => {
  const cacheKey = `scrape_cache_${url}`;
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // 1. Check localStorage for a cached version
  try {
    const cachedItem = localStorage.getItem(cacheKey);
    if (cachedItem) {
      const { timestamp, markdownContent } = JSON.parse(cachedItem);
      if (now - timestamp < ONE_DAY_MS) {
        console.log(`[Scrape Cache] HIT for URL: ${url}`);
        toast.success('URL Content Loaded from Cache', {
          description: 'Using recently scraped content for this URL.',
          duration: 3000,
        });
        return markdownContent;
      } else {
        console.log(`[Scrape Cache] STALE for URL: ${url}`);
        localStorage.removeItem(cacheKey); // Remove stale item
      }
    }
  } catch (e) {
    console.error("[Scrape Cache] Error reading from localStorage:", e);
  }

  // 2. If cache miss or stale, fetch from the API
  console.log(`[Scrape Cache] MISS for URL: ${url}. Fetching from API.`);
  const scrapeApiEndpoint = getAssetPath('/api/scrape');

  try {
    const response = await fetch(scrapeApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortController.signal,
      body: JSON.stringify({ urlToScrape: url }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to parse scrape error response' }));
      toast.warning('URL Scraping Failed', {
        description: `Could not get content for the URL. Error: ${errorData.message || response.statusText}`,
        duration: 5000,
      });
      return null;
    }

    const result = await response.json();

    if (result.success && result.markdownContent) {
      // 3. Store the new data in localStorage
      try {
        const newItem = {
          timestamp: now,
          markdownContent: result.markdownContent,
        };
        localStorage.setItem(cacheKey, JSON.stringify(newItem));
        console.log(`[Scrape Cache] SET for URL: ${url}`);
      } catch (e) {
        console.error("[Scrape Cache] Error writing to localStorage:", e);
      }

      toast.success('URL Content Scraped', {
        description: 'Fresh content from the URL will be used.',
        duration: 3000,
      });
      return result.markdownContent;
    } else {
      toast.warning('URL Scraping Issue', {
        description: result.message || 'Scraping completed but no content was returned.',
        duration: 5000,
      });
      return null;
    }

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[Scrape] Request aborted.');
      return null;
    }
    console.error('[Scrape] Error calling backend scrape endpoint:', error);
    toast.error('Scraping Error', {
      description: `An error occurred while trying to scrape the URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: 5000,
    });
    return null;
  }
};
// --- End Add ---

// Format previous messages to pass to API
export const fetchResponse = async (
  input: string,
  messages: Message[],
  selectedModel: string,
  abortController: AbortController,
  setMessages: MessageUpdater,
  assistantMessage: Message,
  attachments?: File[],
  activeFiles?: Array<{ name: string; type: string; uri: string }>,
  onFileUploaded?: (fileInfo: { name: string; type: string; uri: string }) => void,
  enhancerMode: 'auto' | 'manual' = 'auto'
) => {
  const trimmedInput = input.trim();
  let command: '/movies' | '/tv' | '/weather' | null = null;
  let commandQuery: string | null = null;
  let finalInput = trimmedInput; // Use a new variable for potentially modified input

  // --- Automatically enhance query for non-commands/URLs ---
  if (enhancerMode === 'auto' && !finalInput.startsWith('/') && !finalInput.match(URL_REGEX) && selectedModel !== 'exa') {
    const enhanced = await enhanceQuery(finalInput);
    if (enhanced.trim().toLowerCase() !== finalInput.toLowerCase()) {
      console.log(`Query auto-corrected from "${finalInput}" to "${enhanced}"`);
      finalInput = enhanced; // Use the enhanced query
      toast.info(`Auto enhanced query: "${enhanced}"`);
    }
  }
  // --- End auto-enhancement ---

  // --- Modify URL Detection and Scraping Logic ---
  const detectedUrls = trimmedInput.match(URL_REGEX);
  let scrapedContent: string | null = null;

  if (detectedUrls && detectedUrls.length > 0 && selectedModel !== 'exa') {
    const urlToScrape = detectedUrls[0];
    console.log(`[Fetch] URL detected: ${urlToScrape}. Checking/getting content...`);
    
    // Show an initial message indicating processing is happening
    updateMessages(setMessages, (prev: Message[]) =>
      prev.map((msg: Message) =>
        msg.id === assistantMessage.id
          ? { ...msg, content: 'Analyzing URL...' } // Temporary message
          : msg
      )
    );

    // Call the updated scrape function (handles backend call & localStorage)
    scrapedContent = await scrapeUrlContent(urlToScrape, abortController);

    // --- Update finalInput based on scrapedContent --- 
    if (scrapedContent) {
      finalInput = `USER QUESTION: "${trimmedInput}"\n\nADDITIONAL CONTEXT FROM SCRAPED URL (${urlToScrape}):\n---\n${scrapedContent}\n---\n\nBased on the user question and the scraped context above, please provide an answer.`;
      console.log("[Fetch] Input augmented with scraped content.");
    } else {
      console.log("[Fetch] No valid scraped content available. Proceeding with original query.");
      // finalInput remains trimmedInput
    }
    
    // Update assistant message placeholder now that scraping attempt is done
    updateMessages(setMessages, (prev: Message[]) =>
      prev.map((msg: Message) =>
        msg.id === assistantMessage.id
          ? { ...msg, content: '...' } // Ready for LLM response
          : msg
      )
    );
  }
  // --- End Modify ---

  // --- Autonomous Tool-Calling Logic ---
  // Check if the input is a manual command first
  if (finalInput.startsWith('/')) {
    const parts = finalInput.split(' ');
    const potentialCommand = parts[0];
    if (availableTools.some(t => t.command === potentialCommand)) {
      command = potentialCommand as any; // Trusting the check
      commandQuery = parts.slice(1).join(' ');
    }
  } else if (selectedModel !== 'exa' && !finalInput.match(URL_REGEX)) {
    // If it's not a manual command, analyze for autonomous tool use
    const toolResult = await analyzeQueryForTools(finalInput, messages);
    if (toolResult) {
      // If a tool is identified, set the command and query to be executed directly
      console.log(`Autonomous tool execution identified: ${toolResult.command}`);
      command = toolResult.command as any;
      commandQuery = toolResult.query;

      // Update the assistant message to indicate tool usage
      updateMessages(setMessages, (prev: Message[]) =>
        prev.map((msg: Message) =>
          msg.id === assistantMessage.id
            ? { ...msg, content: `> Running tool: \`${command} ${commandQuery}\`\n\n_Getting results..._` }
            : msg
        )
      );
    }
  }
  // --- End Autonomous Tool-Calling Logic ---

  if (finalInput.startsWith('/movies ')) { // Check modified input for commands
    command = '/movies';
    commandQuery = finalInput.substring(8).trim(); // Get text after "/movies "
  } else if (finalInput.startsWith('/tv ')) { // Check modified input for commands
    command = '/tv';
    commandQuery = finalInput.substring(5).trim(); // Get text after "/tv "
  }

  // Prepare messages for conversation history, ensuring we respect context limits
  // Needed for both command handler fallback (potentially) and standard LLM calls
  const truncatedMessages = truncateConversationHistory(messages, selectedModel);
  
  let response;

  try {
    // --- Handle Slash Commands ---
    if (command && commandQuery) {
      console.log(`Handling command: ${command} with query: ${commandQuery}`);
      const commandApiEndpoint = getAssetPath('/api/command-handler');
      
      response = await fetch(commandApiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        signal: abortController.signal,
        // credentials: 'include', // If your command handler needs auth
        body: JSON.stringify({ command, query: commandQuery }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Command handler API request failed: ${response.status}`, errorText);
        throw new Error(`Command handler failed: ${response.statusText || errorText}`);
      }

      // Command handler returns complete JSON, not a stream
      const result = await response.json();
      let finalAssistantMessage: Message;

      if (result.type === 'media_result') {
        console.log('Received media_result:', result.data);
        finalAssistantMessage = {
          ...assistantMessage,
          content: result.answer, // The text answer generated by LLM
          mediaData: result.data, // The structured media data for the card
          completed: true,
          // Could set startTime/endTime based on this single request duration if desired
          startTime: assistantMessage.startTime || Date.now(), // Or set more accurately
          endTime: Date.now(),
          tps: 0, // TPS not really applicable here
        };
      } else if (result.type === 'weather_result') {
        console.log('Received weather_result:', result.data);
        finalAssistantMessage = {
          ...assistantMessage,
          content: result.answer, // The text answer generated by LLM
          weatherData: result.data, // The structured weather data for the card
          completed: true,
          startTime: assistantMessage.startTime || Date.now(),
          endTime: Date.now(),
          tps: 0,
        };
      } else if (result.type === 'no_result' || result.type === 'error') {
        console.log(`Command handler returned: ${result.type}`);
        finalAssistantMessage = {
          ...assistantMessage,
          content: result.message, // Display the message from the handler
          completed: true,
          startTime: assistantMessage.startTime || Date.now(),
          endTime: Date.now(),
          tps: 0,
        };
      } else {
        // Unexpected response type
        throw new Error(`Unexpected response type from command handler: ${result.type}`);
      }

      // Update the UI with the final message state
      updateMessages(setMessages, (prev: Message[]) =>
        prev.map((msg: Message) =>
          msg.id === assistantMessage.id ? finalAssistantMessage : msg
        )
      );

      return finalAssistantMessage; // Return the completed message

    } else {
      // --- Existing Logic for Standard LLM Calls --- 
      
      // Format previous messages into conversation history
      const conversationHistory = truncatedMessages.map(msg => 
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n');
      
      // Combine history with new query
      const fullQuery = conversationHistory 
        ? `${conversationHistory}\nUser: ${finalInput}` // Use potentially modified input
        : finalInput; // Use potentially modified input

      // Determine which API endpoint to use based on the selected model
      let apiEndpoint;
      let useFormDataForGemini = false;
      const modelConfig = modelsConfig.models.find((m: Record<string, unknown>) => m.id === selectedModel);
      
      if (selectedModel === 'exa') {
        apiEndpoint = getAssetPath('/api/exaanswer');
      } else if (modelConfig?.toolCallType === 'openrouter' || selectedModel === 'gemma3-27b') {
        apiEndpoint = getAssetPath('/api/openrouter');
      } else if (modelConfig?.providerId === 'together') {
        // Route to the Together AI handler for image generation
        apiEndpoint = getAssetPath('/api/together');
        // Check if this model has imageGenerationMode flag
        const isImageGeneration = !!modelConfig?.imageGenerationMode;
        console.log(`Using Together AI endpoint for ${isImageGeneration ? 'image generation' : 'text generation'}`);
      } else if (selectedModel.includes('gemini')) {
        apiEndpoint = getAssetPath('/api/gemini');
        if ((attachments && attachments.length > 0) || (activeFiles && activeFiles.length > 0)) {
          useFormDataForGemini = true;
          console.log("Preparing FormData request for Gemini (new attachments or active files present).");
        }
      } else if (modelConfig?.providerId === 'cerebras') {
        apiEndpoint = getAssetPath('/api/cerebras');
      } else if (modelConfig?.providerId === 'xai') {
        // Route to the new xAI handler (needs implementation)
        apiEndpoint = getAssetPath('/api/xai'); 
      } else {
        apiEndpoint = getAssetPath('/api/groq');
      }

      console.log(`Sending request to ${apiEndpoint} with model ${selectedModel}`);
      
      const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        signal: abortController.signal,
        credentials: 'include' as RequestCredentials,
      };
      
      let requestBody: BodyInit;

      if (useFormDataForGemini) {
        // --- Create FormData for Gemini with Attachments ---
        const formData = new FormData();
        formData.append('query', finalInput); // Send potentially modified input query
        formData.append('model', selectedModel);
        formData.append('messages', JSON.stringify(truncatedMessages)); 
        if (attachments && attachments.length > 0) {
          attachments.forEach((file, index) => {
            formData.append(`attachment_${index}`, file, file.name);
            console.log(`Appended NEW file to FormData: ${file.name}`);
          });
        } else {
          console.log("No new attachments to append for this request.");
        }
        if (activeFiles && activeFiles.length > 0) {
          formData.append('activeFiles', JSON.stringify(activeFiles));
          console.log(`Appended ${activeFiles.length} active file references to FormData.`);
        }
        requestBody = formData;
        // Remove Content-Type header, let the browser set it for FormData
        if (requestOptions.headers) {
          delete (requestOptions.headers as Record<string, string>)['Content-Type'];
        }
        console.log("Using FormData body for the request.");
        // --- End FormData Creation ---
      } else {
        // --- Use JSON Body for other requests or Gemini without Attachments ---
        const jsonPayload = selectedModel === 'exa' 
          ? { query: finalInput, messages: truncatedMessages } 
          : modelConfig?.providerId === 'together' && modelConfig?.imageGenerationMode
            ? { model: selectedModel, prompt: finalInput, dimensions: { width: 1024, height: 768 } }
            : { query: fullQuery, model: selectedModel, messages: truncatedMessages, systemPrompt: ASSISTANT_SYSTEM_PROMPT };
        requestBody = JSON.stringify(jsonPayload);
        console.log("Using JSON body for the request.");
        // --- End JSON Body Creation ---
      }
      
      // Make the fetch request for standard LLM
      response = await fetch(
        apiEndpoint, 
        {
          ...requestOptions,
          body: requestBody,
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
            // @ts-expect-error - adding custom properties
            rateLimitError.waitTime = waitTime;
            // @ts-expect-error - adding custom properties
            rateLimitError.details = message;
            
            throw rateLimitError;
          }
          
          console.error('API Error Data:', errorData);
          throw new Error(errorData.message || errorData.error?.message || `API error: ${response.status}`);
        }
        
        // Handle non-JSON errors
        const errorText = await response.text();
        console.error('API Error Text:', errorText);
        throw new Error(errorText || `API request failed with status ${response.status}`);
      }
      
      // --- Existing Stream Handling Logic --- 
      if (!response.body) {
        throw new Error('Response body is null');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = '';
      let citations: any[] | undefined = undefined; // Use any[] to match type def
      let startTime: number | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.citations) {
              citations = data.citations;
              updateMessages(setMessages, (prev: Message[]) => 
                prev.map((msg: Message) => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, citations: data.citations } 
                    : msg
                )
              );
            }
            // Handle file uploads from Gemini API
            if (data.type === 'file_uploaded' && data.data && onFileUploaded) {
              console.log("File uploaded event received:", data.data);
              data.data.forEach((fileInfo: { name: string; type: string; uri: string }) => {
                onFileUploaded(fileInfo);
              });
              continue; // Skip content update for this event
            }
            if (data.choices && data.choices[0]?.delta?.content) {
              const newContent = data.choices[0].delta.content;
              content += newContent;
              if (startTime === null && newContent.length > 0) {
                startTime = Date.now();
              }
              const isEndOfStream = line.includes('"finish_reason"') || line.includes('"done":true') || data.choices[0]?.finish_reason;
              updateMessages(setMessages, (prev: Message[]) => 
                prev.map((msg: Message) => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, content: content, completed: isEndOfStream, startTime: startTime ?? undefined } 
                    : msg
                )
              );
            }
          } catch { continue; }
        }
      }

      // After streaming completes, calculate TPS and make final update
      const endTime = Date.now();
      const estimatedTokens = content.length > 0 ? content.length / 4 : 0;
      const durationSeconds = startTime ? (endTime - startTime) / 1000 : 0;
      const calculatedTps = durationSeconds > 0 ? estimatedTokens / durationSeconds : 0;

      const finalAssistantMessage: Message = {
        ...assistantMessage,
        content,
        citations,
        completed: true,
        startTime: startTime ?? undefined,
        endTime,
        tps: calculatedTps
      };
      updateMessages(setMessages, (prev: Message[]) => 
        prev.map((msg: Message) => 
          msg.id === assistantMessage.id ? finalAssistantMessage : msg
        )
      );
      return finalAssistantMessage; // Return the complete message object
    }

  } catch (err) {
    console.error('Error in fetchResponse:', err);
    
    if (err instanceof Error && err.message.includes('Authentication')) {
      throw err;
    }
    
    if (err instanceof Error && err.name === 'RateLimitError') {
       // Toast already shown, just rethrow to stop processing
       throw err;
    }
    
    // Generic error toast for other failures
    toast.error('Error processing request', {
      description: err instanceof Error ? err.message : 'Unknown error occurred',
      duration: 5000
    });
    
    throw err;
  }
}; 