import { NextRequest } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { processImageData } from '@/lib/supabase';
import { CoreMessage, streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Change to auto for optimization
export const dynamic = 'auto';
export const maxDuration = 60; // Maximum allowed for Vercel Hobby plan

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

// Define the expected type for Google AI SDK safety settings based on provider requirements
type GoogleSafetySetting = {
  category: "HARM_CATEGORY_HARASSMENT" | "HARM_CATEGORY_HATE_SPEECH" | "HARM_CATEGORY_SEXUALLY_EXPLICIT" | "HARM_CATEGORY_DANGEROUS_CONTENT" | "HARM_CATEGORY_UNSPECIFIED" | "HARM_CATEGORY_CIVIC_INTEGRITY";
  threshold: "BLOCK_NONE" | "BLOCK_ONLY_HIGH" | "BLOCK_MEDIUM_AND_ABOVE" | "BLOCK_LOW_AND_ABOVE" | "HARM_BLOCK_THRESHOLD_UNSPECIFIED";
};

// Map safety settings to ai-sdk format (string thresholds and categories)
const mapSafetySettingsToAISDK = (settings: typeof safetySettings): GoogleSafetySetting[] => {
  const categoryMapping = {
    [HarmCategory.HARM_CATEGORY_HARASSMENT]: 'HARM_CATEGORY_HARASSMENT',
    [HarmCategory.HARM_CATEGORY_HATE_SPEECH]: 'HARM_CATEGORY_HATE_SPEECH',
    [HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT]: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    [HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT]: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    // Add others if needed, ensure keys match the enum values if used elsewhere
  };

  const thresholdMapping = {
    [HarmBlockThreshold.BLOCK_NONE]: 'BLOCK_NONE',
    [HarmBlockThreshold.BLOCK_ONLY_HIGH]: 'BLOCK_ONLY_HIGH',
    [HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE]: 'BLOCK_MEDIUM_AND_ABOVE',
    [HarmBlockThreshold.BLOCK_LOW_AND_ABOVE]: 'BLOCK_LOW_AND_ABOVE',
    [HarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED]: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
  };

  return settings
    .map(setting => ({
      // Map category enum to string using the mapping
      // Cast the enum key to assert it exists in our mapping
      category: categoryMapping[setting.category as keyof typeof categoryMapping],
      // Map threshold enum to string using the mapping
      threshold: thresholdMapping[setting.threshold] || 'BLOCK_MEDIUM_AND_ABOVE', // Fallback
    } as GoogleSafetySetting)) // Assert the created object matches the required type
    .filter(setting => setting.category !== undefined); // Filter out any settings with unmapped categories
};

export async function POST(req: NextRequest) {
  let model: string = '';  // Declare at the top level of the function
  let API_KEY: string | undefined; // Define API_KEY scope

  try {
    // Parse request body first
    const body = await req.json();

    // Handle warmup requests quickly
    if (body.warmup === true) {
      return handleWarmup();
    }

    const { query, messages } = body;
    model = body.model || '';  // Assign the value

    if (!query && (!messages || messages.length === 0)) { // Need either query or messages
      return new Response(JSON.stringify({ error: 'query or messages is required' }), { status: 400 });
    }
    if (!model) {
      return new Response(JSON.stringify({ error: 'model is required' }), { status: 400 });
    }

    // Log minimal information
    console.log(`Gemini request: ${model} [${messages?.length || 0} msgs]`);

    // Get Google API key from environment variable
    API_KEY = process.env.GOOGLE_AI_API_KEY;

    if (!API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY environment variable not set');
    }

    // Get the actual model name from the mapping
    const actualModelName = MODEL_MAPPING[model] || model;

    // Check if this is an image generation request
    if (IMAGE_GENERATION_MODELS.includes(actualModelName)) {
      // Initialize the original Google Generative AI client ONLY for image generation
      const genAI = new GoogleGenerativeAI(API_KEY);
      // TODO: Migrate image generation to ai-sdk if possible/feasible
      return handleImageGeneration(genAI, actualModelName, query || messages?.[messages.length - 1]?.content || '', messages);
    }

    // --- Text Generation using AI SDK ---

    // Initialize the ai-sdk Google provider
    const google = createGoogleGenerativeAI({
      apiKey: API_KEY,
      // baseURL, // Optional: for custom endpoints
      // headers, // Optional: for custom headers
      // generateId, // Optional: for custom request IDs
    });

    // Format messages for ai-sdk (CoreMessage format)
    // Ensure messages is an array, handle potential 'query' field if messages is empty/missing
    let coreMessages: CoreMessage[] = [];
    if (messages && Array.isArray(messages)) {
      coreMessages = messages.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant', // Map roles
        content: msg.content || '', // Ensure content is a string
      }));
    }

    // If 'query' exists and it's not the last message, add it
    if (query && (coreMessages.length === 0 || coreMessages[coreMessages.length - 1].content !== query)) {
       coreMessages.push({ role: 'user', content: query });
    }

    // Check if messages array is empty after processing
    if (coreMessages.length === 0) {
        return new Response(JSON.stringify({ error: 'Cannot process empty query or messages' }), { status: 400 });
    }

    // Map safety settings to ai-sdk format
    const aiSdkSafetySettings = mapSafetySettingsToAISDK(safetySettings);

    // Call streamText with the provider instance, model, messages, and settings
    const result = await streamText({
      // Pass model name and provider-specific options (like safetySettings) here
      model: google(actualModelName, { safetySettings: aiSdkSafetySettings }), 
      messages: coreMessages,
      // safetySettings: aiSdkSafetySettings, // <-- Moved into model definition above
      // Generation config parameters (optional, map from existing if needed)
      temperature: 0.7,
      topP: 0.95,
      topK: 64,
      // system: undefined, // Optional system prompt
      // maxTokens: undefined, // Optional max tokens
      // frequencyPenalty: undefined, // Optional
      // presencePenalty: undefined, // Optional
    });

    // Respond with the stream
    return result.toDataStreamResponse();

  } catch (error: any) {
    console.error('Google AI API error (ai-sdk):', error);

    // Improved error handling for ai-sdk
    const errorMsg = error.message || error.toString();
    let status = 500;
    let errorResponse = {
      error: 'Failed to process Google AI request.',
      message: 'An unexpected error occurred. Please try again.',
      details: errorMsg, // Include original error message for debugging
      // model: model // Include the requested model if available
    };

    // Check for specific error types if possible (e.g., model not found, API key invalid, rate limits)
    // The ai-sdk might throw specific error classes or include codes
    if (error.cause) { // ai-sdk often wraps errors
        console.error('Error Cause:', error.cause);
        if (error.message.includes('API key not valid')) {
            status = 401; // Unauthorized
            errorResponse.error = 'Invalid API Key';
            errorResponse.message = 'The provided GOOGLE_AI_API_KEY is invalid.';
        } else if (error.message.includes('not found') || error.message.includes('404')) {
             status = 404; // Not Found
             errorResponse.error = `Model not found: "${model || 'unknown'}"`;
             // Try to provide suggestions if possible, maybe keep the listAvailableModels logic simplified
             const modelSuggestions = AVAILABLE_MODELS.join(', ');
             errorResponse.message = `The requested model is unavailable. Available models might include: ${modelSuggestions}.`;
        } else if (error.message.includes('429') || error.message.includes('rate limit')) {
             status = 429; // Too Many Requests
             errorResponse.error = 'Rate limit exceeded';
             errorResponse.message = 'You have exceeded the rate limit for the Google AI API. Please try again later.';
        }
         else if (error.message.includes('Safety rating')) {
             status = 400; // Bad Request (often indicates safety block)
             errorResponse.error = 'Content blocked due to safety settings';
             errorResponse.message = 'The request was blocked due to content safety filters.';
        }
    } else if (errorMsg.includes('GOOGLE_AI_API_KEY environment variable not set')) {
        status = 500; // Internal Server Error (configuration issue)
        errorResponse.error = 'Configuration Error';
        errorResponse.message = 'The Google AI API key is not configured on the server.';
    }

     return new Response(
       JSON.stringify(errorResponse),
       { status: status, headers: { 'Content-Type': 'application/json' } }
     );

  }
}

// Handler for image generation requests - REMAINS UNCHANGED FOR NOW
// TODO: Migrate image generation to ai-sdk if possible/feasible
async function handleImageGeneration(
  genAI: any, // Keep using the original genAI instance passed in
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
              
              // Verify it's valid base64 by attempting to decode and check length
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

    if (imagesForProcessing.length === 0 && formattedResponse.text.length === 0) {
      console.warn('No valid images or text found in the Gemini response');
       // Provide fallback text if nothing is generated
       formattedResponse.text = "I attempted to generate content based on your request, but wasn't able to create anything. This might be due to content safety policies or technical limitations. Please try again with a different description.";
    } else if (imagesForProcessing.length === 0) {
       console.warn('No valid images found in the Gemini response, only text was generated.');
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