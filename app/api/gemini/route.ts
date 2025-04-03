import { NextRequest } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { processImageData } from '@/lib/supabase';

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

const MODEL_MAPPING: Record<string, string> = {
  'gemini-2.5-pro-exp-03-25': 'gemini-2.5-pro-exp-03-25', // Direct mapping to call the 2.5 model
  'gemini-2.0-pro-exp-02-05': 'gemini-2.0-pro-exp-02-05', // Direct mapping to call the 2.0 model
  'gemini-2.0-flash': 'gemini-2.0-flash', // Direct mapping for 2.0 flash model
  'gemini-2.0-flash-thinking-exp-01-21': 'gemini-2.0-flash-thinking-exp-01-21', // Direct mapping for flash thinking model
  'gemini-2.0-flash-exp-image-generation': 'gemini-2.0-flash-exp-image-generation', // Image generation model
};

// Define image generation models to use special handling
const IMAGE_GENERATION_MODELS = [
  'gemini-2.0-flash-exp-image-generation',
];

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
    
    // Check if this is an image generation request
    if (IMAGE_GENERATION_MODELS.includes(actualModelName)) {
      return handleImageGeneration(genAI, actualModelName, query, messages);
    }
    
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

// Handler for image generation requests
async function handleImageGeneration(
  genAI: any, 
  modelName: string, 
  prompt: string, 
  messages: any[]
) {
  try {
    console.log(`Generating image with model: ${modelName}, prompt: "${prompt.substring(0, 50)}..."`);
    
    // Create a model instance with response modality settings for both text and image
    const imageModel = genAI.getGenerativeModel({
      model: modelName,
      safetySettings,
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"] // Use uppercase as per API spec
      }
    });

    // Create formatted content from the prompt
    // For simplicity we just use the prompt directly
    const generationResponse = await imageModel.generateContent({
      contents: [{ 
        role: 'user', 
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"] // Also include in the request itself
      }
    });

    // Process the response to extract text and images
    const response = generationResponse.response;
    if (!response) {
      throw new Error("No response received from image generation model");
    }

    // Log the response structure to help debug
    console.log('Image generation response structure:', 
      JSON.stringify({
        hasResponse: !!response,
        hasCandidates: !!response.candidates,
        candidatesCount: response.candidates?.length || 0,
        firstCandidate: response.candidates?.[0] ? {
          hasContent: !!response.candidates[0].content,
          hasParts: !!response.candidates[0].content?.parts,
          partsCount: response.candidates[0].content?.parts?.length || 0
        } : null
      }, null, 2)
    );

    // Format the response for the client
    interface ImageData {
      mimeType: string;
      data: string;
      url?: string | null;  // Change to allow null for type compatibility
    }
    
    const formattedResponse: {
      text: string;
      images: ImageData[];
    } = {
      text: '', // Will contain text parts
      images: [] // Will contain image parts
    };

    // Extract text and images from response
    const imagesForProcessing: ImageData[] = [];
    
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            formattedResponse.text += part.text;
          } else if (part.inlineData) {
            // Ensure the image data is valid
            try {
              // Verify we have proper base64 data
              if (!part.inlineData.data) {
                console.error('Image data is missing in response part');
                continue;
              }
              
              // If data contains a data URL prefix, strip it
              let imageData = part.inlineData.data;
              console.log('Raw image data prefix:', imageData.substring(0, 50));
              
              if (imageData.startsWith('data:')) {
                console.log('Image data contains data URL prefix, stripping it');
                const commaIndex = imageData.indexOf(',');
                if (commaIndex !== -1) {
                  imageData = imageData.substring(commaIndex + 1);
                }
              }
              
              // Verify it's valid base64 by attempting to decode and checking length
              try {
                // Check if it's a valid base64 string
                const decodedSample = atob(imageData.slice(0, 10));
                console.log(`Successfully decoded sample base64 (${imageData.length} chars)`);
                
                // Add the valid image to processing queue
                imagesForProcessing.push({
                  mimeType: part.inlineData.mimeType || 'image/png',
                  data: imageData
                });
              } catch (decodeError) {
                console.error('Failed to decode base64:', decodeError);
                
                // Try alternative encoding if standard fails
                if (typeof Buffer !== 'undefined') {
                  try {
                    // Try using Buffer (for Node.js environments)
                    const buffer = Buffer.from(imageData, 'base64');
                    console.log('Successfully decoded with Buffer method');
                    
                    imagesForProcessing.push({
                      mimeType: part.inlineData.mimeType || 'image/png',
                      data: imageData
                    });
                  } catch (bufferError) {
                    console.error('Failed to decode even with Buffer method:', bufferError);
                  }
                }
              }
            } catch (err) {
              console.error('Invalid image data in response:', err);
            }
          }
        }
      }
    }

    // Log image count for debugging
    console.log(`Extracted ${imagesForProcessing.length} images and ${formattedResponse.text.length > 0 ? 'text content' : 'no text'}`);
    
    if (imagesForProcessing.length === 0) {
      console.warn('No valid images found in the Gemini response');
    } else {
      console.log('Images data sizes:', imagesForProcessing.map(img => img.data.length));
    }
    
    // Upload images to Supabase
    let processedImages: (ImageData | null)[] = [];
    try {
      console.log('Starting image processing with Supabase...');
      const uploadPromises = imagesForProcessing.map(img => processImageData(img));
      processedImages = await Promise.all(uploadPromises);
      console.log('Images processing complete:', processedImages.map(img => img ? !!img.url : null));
    } catch (error) {
      console.error('Error during image processing:', error);
    }
    
    // Add processed images to response, filtering out nulls
    formattedResponse.images = processedImages.filter(img => img !== null) as ImageData[];
    
    console.log('Final images count:', formattedResponse.images.length);
    console.log('Images have URLs:', formattedResponse.images.map(img => !!img.url));
    
    // If no images or text were found, provide fallback content
    if (formattedResponse.images.length === 0 && formattedResponse.text.length === 0) {
      formattedResponse.text = "I attempted to generate an image based on your request, but wasn't able to create one. This might be due to content safety policies or technical limitations. Please try again with a different description.";
    }
    
    // Return the formatted response
    return new Response(
      JSON.stringify(formattedResponse),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );
  } catch (error: any) {
    console.error('Error generating image with Gemini:', error);
    
    // Check if it's a 404 error (model not available)
    if (error.toString().includes('404')) {
      return new Response(
        JSON.stringify({
          error: 'Model not available',
          message: "The image generation model is currently not available or experimental. Please try a different model.",
          text: "The image generation model is currently not available. Please try a different model.",
          images: []
        }),
        { status: 404 }
      );
    }
    
    // Handle rate limiting errors
    if (error.toString().includes('429')) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: "You've reached the rate limit for image generation. Please try again later.",
          text: "You've reached the rate limit for image generation. Please try again later.",
          images: []
        }),
        { status: 429 }
      );
    }
    
    // For other errors
    return new Response(
      JSON.stringify({
        error: `Failed to generate image | ${error.message}`,
        message: "I apologize, but I couldn't generate the requested image. This experimental feature might not be available in your region or API tier.",
        text: "I wasn't able to generate an image due to a technical issue. Please try again with a different model or description.",
        images: []
      }),
      { status: 500 }
    );
  }
} 