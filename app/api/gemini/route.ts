import { NextRequest } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Change to auto for optimization
export const dynamic = 'auto';
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

/**
 * Map model IDs to Google API model names
 * Current model list as of August 2024:
 * - gemini-1.0-pro
 * - gemini-1.0-pro-vision
 * - gemini-1.5-flash
 * - gemini-1.5-pro
 * - gemini-1.5-flash-exp-0827
 * - gemini-1.5-pro-exp-0827
 * - gemini-1.5-flash-8b-exp-0827
 * 
 * Note: The Gemma models are not directly available via the Gemini API.
 * They require the VertexAI API or using them through a provider like Groq.
 * 
 * For experimental models, keep checking Google's documentation as they may be updated frequently.
 * Check https://ai.google.dev/gemini-api/docs/models/gemini for the latest models.
 */
const MODEL_MAPPING: Record<string, string> = {
  'gemini-2.0-pro-exp-02-05': 'gemini-1.5-pro-exp-0827', // Updated to latest experimental model
  'gemini-1.5-pro': 'gemini-1.5-pro', // Direct mapping for stable model
  'gemini-1.5-flash': 'gemini-1.5-flash' // Direct mapping for stable model
};

// Get a list of currently available models
const AVAILABLE_MODELS = Object.values(MODEL_MAPPING);

// Function to get a list of available models from Google's API
async function listAvailableModels(apiKey: string): Promise<string[]> {
  try {
    // The SDK doesn't directly expose listModels, so we'll use a simpler approach
    // with our predefined models that we know work
    return AVAILABLE_MODELS;
  } catch (error) {
    console.error('Error listing models:', error);
    return AVAILABLE_MODELS; // Fallback to our predefined list
  }
}

// Configure safety settings (moderate filtering)
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

export async function POST(req: NextRequest) {
  let model: string = '';  // Declare at the top level of the function
  
  try {
    // Parse request body first
    const body = await req.json();
    
    // Handle warmup requests quickly
    if (body.warmup === true) {
      return handleWarmup();
    }
    
    const { query, messages } = body;
    model = body.model || '';  // Assign the value
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
    }
    if (!model) {
      return new Response(JSON.stringify({ error: 'model is required' }), { status: 400 });
    }

    // Log minimal information
    console.log(`Gemini request: ${model} [${messages?.length || 0} msgs]`);
    
    // Get Google API key from environment variable
    const API_KEY = process.env.GOOGLE_AI_API_KEY;
    
    if (!API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY environment variable not set');
    }
    
    // Initialize the Google Generative AI client
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // Get the actual model name from the mapping
    const actualModelName = MODEL_MAPPING[model] || model;
    
    // Create a model instance
    const genModel = genAI.getGenerativeModel({
      model: actualModelName,
      safetySettings,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
      }
    });
    
    // Format messages for Google's chat API format
    const formattedMessages = messages.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
    
    // Add the current query if not already included
    if (formattedMessages.length === 0 || 
        formattedMessages[formattedMessages.length - 1].role !== 'user') {
      formattedMessages.push({
        role: 'user',
        parts: [{ text: query }]
      });
    }
    
    // Create chat session
    const chat = genModel.startChat({
      history: formattedMessages.slice(0, -1), // All except the last message
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
      }
    });
    
    // Get last user message to send
    const lastUserMessage = formattedMessages[formattedMessages.length - 1].parts[0].text;
    
    // Create a streaming response
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            // Send the message and get streaming response
            const streamingResponse = await chat.sendMessageStream(lastUserMessage);
            
            for await (const chunk of streamingResponse.stream) {
              const text = chunk.text();
              if (text) {
                // Format in a way compatible with client-side parsing
                const message = {
                  choices: [
                    {
                      delta: {
                        content: text
                      }
                    }
                  ]
                };
                
                controller.enqueue(encoder.encode(JSON.stringify(message) + '\n'));
              }
            }
            
            controller.close();
          } catch (error: any) {
            console.error('Error in Google AI stream processing:', error);
            
            // Check if it's a model not found error
            const errorMsg = error.toString();
            if (errorMsg.includes('not found') || errorMsg.includes('404')) {
              // Get real-time list of available models if possible
              let availableModels = AVAILABLE_MODELS;
              try {
                if (process.env.GOOGLE_AI_API_KEY) {
                  availableModels = await listAvailableModels(process.env.GOOGLE_AI_API_KEY);
                }
              } catch (e) {
                // If listing fails, use our predefined list
                console.error("Failed to list models:", e);
              }
              
              const modelSuggestions = availableModels.join(', ');
              
              // Send an error message to the client
              const errorResponse = {
                choices: [
                  {
                    delta: {
                      content: `Error: The selected model "${model}" is currently unavailable. This may be because the model is experimental and has been replaced with a newer version.\n\nAvailable models: ${modelSuggestions}\n\nPlease try selecting one of these models instead.`
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
    console.error('Google AI API error:', error);
    
    // Check if it's a model availability error
    const errorMsg = error.toString();
    let errorResponse;
    
    if (errorMsg.includes('not found') || errorMsg.includes('404')) {
      // Try to get real-time list of available models
      let availableModels = AVAILABLE_MODELS;
      try {
        if (process.env.GOOGLE_AI_API_KEY) {
          availableModels = await listAvailableModels(process.env.GOOGLE_AI_API_KEY);
        }
      } catch (e) {
        // If listing fails, use our predefined list
        console.error("Failed to list models:", e);
      }
      
      const modelSuggestions = availableModels.join(', ');
      
      errorResponse = {
        error: `Model not available: The selected model "${model}" is currently unavailable or has been updated.`,
        message: `Please select a different model. Currently available models include: ${modelSuggestions}. Note that experimental models may change without notice.`
      };
    } else {
      errorResponse = {
        error: `Failed to perform Google AI request | ${error.message}`,
        message: "I apologize, but I couldn't complete your request. Please try again."
      };
    }
    
    return new Response(
      JSON.stringify(errorResponse), 
      { status: 500 }
    );
  }
} 