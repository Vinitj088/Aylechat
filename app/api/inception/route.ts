import { NextRequest } from 'next/server';

// Change to force-dynamic to ensure the route is never cached
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Maximum allowed for Vercel Hobby plan

// Pre-define encoder outside the handler for better performance
const encoder = new TextEncoder();

// Handle warmup requests specially
const handleWarmup = () => {
  return new Response(
    JSON.stringify({ status: 'warmed_up' }),
    { status: 200 }
  );
};

const MODEL_MAPPING: Record<string, string> = {
  'mercury': 'mercury',
  'mercury-coder': 'mercury-coder',
};

// Get a list of currently available models
const AVAILABLE_MODELS = Object.values(MODEL_MAPPING);

export async function POST(req: NextRequest) {
  let model: string = '';
  
  try {
    // Check if the request uses FormData
    const contentType = req.headers.get('content-type') || '';
    let query: string | null = null;
    let messagesString: string | null = null;
    let attachments: File[] = [];
    let activeFilesString: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();

      query = formData.get('query') as string | null;
      model = formData.get('model') as string || '';
      messagesString = formData.get('messages') as string | null;
      activeFilesString = formData.get('activeFiles') as string | null;

      // Extract files
      formData.forEach((value, key) => {
        if (value instanceof File) {
          attachments.push(value);
        }
      });

      // Handle warmup in FormData case too
      if (formData.get('warmup') === 'true') {
        return handleWarmup();
      }

    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      
      // Handle warmup requests quickly
      if (body.warmup === true) {
        return handleWarmup();
      }

      query = body.query;
      model = body.model || '';
      messagesString = JSON.stringify(body.messages || []);

    } else {
      return new Response(JSON.stringify({ error: 'Unsupported Content-Type' }), { status: 415 });
    }

    const messages = messagesString ? JSON.parse(messagesString) : [];
    const activeFiles = activeFilesString ? JSON.parse(activeFilesString) : [];
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
    }
    if (!model) {
      return new Response(JSON.stringify({ error: 'model is required' }), { status: 400 });
    }

    // Get Inception API key from environment variable
    const API_KEY = process.env.INCEPTION_API_KEY;
    
    if (!API_KEY) {
      console.error('INCEPTION_API_KEY environment variable not set');
      return new Response(
        JSON.stringify({ 
          error: 'INCEPTION_API_KEY environment variable not set',
          message: 'Please add your Inception AI API key to the environment variables.'
        }), 
        { status: 500 }
      );
    }
    
    console.log('Using Inception API key:', API_KEY.substring(0, 10) + '...');
    
    // Get the actual model name from the mapping
    const actualModelName = MODEL_MAPPING[model] || model;
    
    // Create a streaming response
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            // Send uploaded file metadata back first if there are attachments
            if (attachments.length > 0) {
              const fileEvent = {
                type: 'file_uploaded',
                data: attachments.map(file => ({
                  name: file.name,
                  type: file.type,
                  uri: `file://${file.name}` // Placeholder URI for Inception
                }))
              };
              controller.enqueue(encoder.encode(JSON.stringify(fileEvent) + '\n'));
            }

            // Format messages for Inception API
            const formattedMessages = messages.map((msg: any) => ({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content
            }));

            // Add current query as user message
            formattedMessages.push({
              role: 'user',
              content: query
            });

            // Make request to Inception API
            console.log('Making request to Inception API with model:', actualModelName);
            console.log('Request body:', JSON.stringify({
              model: actualModelName,
              messages: formattedMessages,
              stream: true,
              max_tokens: 4000
            }, null, 2));
            
            const response = await fetch('https://api.inceptionlabs.ai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
              },
              body: JSON.stringify({
                model: actualModelName,
                messages: formattedMessages,
                stream: true,
                max_tokens: 4000
              })
            });

            console.log('Inception API response status:', response.status);
            console.log('Inception API response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
              const errorText = await response.text();
              console.error('Inception API error response:', errorText);
              throw new Error(`Inception API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            if (!response.body) {
              throw new Error('Response body is null');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let content = '';
            let citations: any[] | undefined = undefined;
            let startTime: number | null = null;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              console.log('Raw chunk from Inception API:', chunk);
              const lines = chunk.split('\n').filter(line => line.trim());
              for (const line of lines) {
                try {
                  // Handle Server-Sent Events format - strip "data: " prefix
                  let jsonLine = line;
                  if (line.startsWith('data: ')) {
                    jsonLine = line.substring(6); // Remove "data: " prefix
                  }
                  
                  // Skip [DONE] messages
                  if (jsonLine === '[DONE]') {
                    console.log('Received [DONE] signal from Inception API');
                    continue;
                  }
                  
                  const data = JSON.parse(jsonLine);
                  console.log('Parsed data from Inception API:', data);
                  
                  if (data.citations) {
                    citations = data.citations;
                    // Handle citations if needed
                  }
                  
                  // Handle different possible response formats
                  let newContent = null;
                  
                  // Standard OpenAI format
                  if (data.choices && data.choices[0]?.delta?.content) {
                    newContent = data.choices[0].delta.content;
                  }
                  // Alternative format - direct content
                  else if (data.content) {
                    newContent = data.content;
                  }
                  // Another possible format
                  else if (data.choices && data.choices[0]?.content) {
                    newContent = data.choices[0].content;
                  }
                  
                  if (newContent) {
                    console.log('Extracted content:', newContent);
                    
                    // Simple fix: only add space if content starts with a number and previous content ends with a letter
                    let processedContent = newContent;
                    
                    if (content.length > 0 && 
                        /[a-zA-Z]$/.test(content) && 
                        /^\d/.test(newContent)) {
                      processedContent = ' ' + newContent;
                    }
                    
                    content += processedContent;
                    if (startTime === null && newContent.length > 0) {
                      startTime = Date.now();
                    }
                    
                    const message = {
                      choices: [
                        {
                          delta: {
                            content: processedContent
                          }
                        }
                      ]
                    };
                    
                    console.log('Sending message to client:', message);
                    controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));
                  }
                } catch (error) {
                  console.log('Error parsing line:', line, error);
                  continue;
                }
              }
            }
            
            controller.close();

          } catch (error: any) {
            console.error('Error in Inception AI stream processing:', error);
            
            // Check if it's a model not found error
            const errorMsg = error.toString();
            if (errorMsg.includes('not found') || errorMsg.includes('404')) {
              const modelSuggestions = AVAILABLE_MODELS.join(', ');
              
              const errorResponse = {
                choices: [
                  {
                    delta: {
                      content: `Error: The selected model "${model}" is currently unavailable.\n\nAvailable models: ${modelSuggestions}\n\nPlease try selecting one of these models instead.`
                    }
                  }
                ]
              };
              controller.enqueue(encoder.encode(JSON.stringify(errorResponse) + '\n'));
              controller.close();
            } else {
              // For other errors, propagate the error
              controller.error(error);
            }
          }
        }
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      }
    );
  } catch (error: any) {
    console.error('Inception AI API error:', error);
    
    // Check if it's a model availability error
    const errorMsg = error.toString();
    let errorResponse;
    
    if (errorMsg.includes('not found') || errorMsg.includes('404')) {
      const modelSuggestions = AVAILABLE_MODELS.join(', ');
      
      errorResponse = {
        error: `Model not available: The selected model "${model}" is currently unavailable or has been updated.`,
        message: `Please select a different model. Currently available models include: ${modelSuggestions}.`
      };
    } else {
      errorResponse = {
        error: `Failed to perform Inception AI request | ${error.message}`,
        message: "I apologize, but I couldn't complete your request. Please try again."
      };
    }
    
    return new Response(
      JSON.stringify(errorResponse), 
      { status: 500 }
    );
  }
} 