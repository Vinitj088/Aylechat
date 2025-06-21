import { NextRequest } from 'next/server';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Part, Modality } from '@google/genai';
import { processImageData } from '@/lib/supabase';
import { Content } from '@google/genai';

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
  'gemini-2.5-flash-lite-preview-06-17': 'gemini-2.5-flash-lite-preview-06-17', // Direct mapping to call the 2.5 model
  'gemini-2.5-flash': 'gemini-2.5-flash', // Direct mapping for 2.5 flash preview
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
    // Check if the request uses FormData
    const contentType = req.headers.get('content-type') || '';
    let query: string | null = null;
    let messagesString: string | null = null;
    let attachments: File[] = []; // Store File objects
    let activeFilesString: string | null = null; // For Step 2

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();

      query = formData.get('query') as string | null;
      model = formData.get('model') as string || '';
      messagesString = formData.get('messages') as string | null;
      activeFilesString = formData.get('activeFiles') as string | null; // For Step 2

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
      // Fallback or specific handling for JSON if needed (e.g., warmup)
      const body = await req.json();
      
      // Handle warmup requests quickly
      if (body.warmup === true) {
        return handleWarmup();
      }

      // For regular JSON requests without files (if any)
      query = body.query;
      model = body.model || '';
      messagesString = JSON.stringify(body.messages || []);
      // No attachments in JSON case

    } else {
      return new Response(JSON.stringify({ error: 'Unsupported Content-Type' }), { status: 415 });
    }

    const messages = messagesString ? JSON.parse(messagesString) : [];
    // Parse active files if present (For Step 2)
    const activeFiles = activeFilesString ? JSON.parse(activeFilesString) : [];
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
    }
    if (!model) {
      return new Response(JSON.stringify({ error: 'model is required' }), { status: 400 });
    }

    // Log minimal information
    
    // Get Google API key from environment variable
    const API_KEY = process.env.GOOGLE_AI_API_KEY;
    
    if (!API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY environment variable not set');
    }
    
    // Initialize the Google Generative AI client (using the new SDK)
    const genAI = new GoogleGenAI({ apiKey: API_KEY });
    
    // Get the actual model name from the mapping
    const actualModelName = MODEL_MAPPING[model] || model;
    
    // Check if this is an image generation request (remains unchanged for now)
    if (IMAGE_GENERATION_MODELS.includes(actualModelName)) {
      // NOTE: Removed redundant body parsing. Use existing variables.
      // Ensure that the required data (query, messages) was extracted earlier
      // based on the initial Content-Type check.
      if (!query) {
        // Handle cases where query might be missing if the initial request wasn't JSON
        // or didn't contain the expected fields. This depends on your image generation logic.
        // For now, let's assume image generation requests *always* send JSON with a query.
        console.error("Image generation request missing query after initial body parsing.");
        return new Response(JSON.stringify({ error: 'Query is required for image generation' }), { status: 400 });
      }
      // Assuming handleImageGeneration can use the parsed messages array
      return handleImageGeneration(genAI, actualModelName, query, messages);
    }
    
    // @ts-ignore - Suppress error, assuming method exists based on docs
    // Removed genModel initialization, will call generateContentStream directly

    // --- File Upload Logic using Files API ---
    const uploadedFileParts: Part[] = []; // Use Part type
    const uploadedFileMetadata: Array<{ name: string; type: string; uri: string }> = []; // For Step 1
    if (attachments.length > 0) {
        for (const file of attachments) {
            try {
                // Convert File to ArrayBuffer, then to Blob
                const arrayBuffer = await file.arrayBuffer();
                const blob = new Blob([arrayBuffer], { type: file.type });
                
                // Use genAI.files.upload from the new SDK
                // Pass Blob and rely on its type for mimeType inference
                const uploadResult = await genAI.files.upload({
                    file: blob, // Pass Blob
                });
                
                // Access uri and mimeType directly from uploadResult based on JS example
                if (!uploadResult.uri || !uploadResult.mimeType) {
                  console.error(`Upload result missing URI or mimeType for ${file.name}:`, uploadResult);
                  throw new Error(`Failed to get URI/mimeType after uploading ${file.name}`);
                }
                
                // Add the file part for generateContent call
                uploadedFileParts.push({
                    fileData: {
                        mimeType: uploadResult.mimeType,
                        fileUri: uploadResult.uri,
                    },
                });
                // Store metadata to send back to client (For Step 1)
                uploadedFileMetadata.push({
                  name: file.name,
                  type: uploadResult.mimeType,
                  uri: uploadResult.uri
                });
            } catch (uploadError) {
                console.error(`Failed to upload file ${file.name}:`, uploadError);
                // Optionally, inform the client about the specific file failure
                // For now, we'll just skip the file and continue
            }
        }
    }
    // --- End File Upload Logic ---
    
    // Format history messages (excluding the current query/attachments)
    const historyMessages: Content[] = messages.map((msg: any) => {
      // For history, we only care about text content currently.
      // The Files API handles files separately for the *current* turn.
      return {
        role: msg.role === 'user' ? 'user' : 'model',
        // Ensure parts always contains at least one text part, even if empty
        parts: msg.content ? [{ text: msg.content }] : [{ text: '' }] 
      };
    }).filter((msg: Content) => msg.parts && msg.parts.some(part => part.text !== undefined)); // Add check for msg.parts


    // Construct the parts for the *current* user message
    const currentUserParts: Part[] = []; // Use Part type
    if (query) {
      currentUserParts.push({ text: query });
    }
    // Combine newly uploaded files and active file references (For Step 2)
    const combinedFilePartsMap = new Map<string, Part>();

    // Add newly uploaded files first (these take precedence if URI conflicts)
    uploadedFileParts.forEach(part => {
      if (part.fileData?.fileUri) {
        combinedFilePartsMap.set(part.fileData.fileUri, part);
      }
    });

    // Add active files passed from the frontend, avoiding duplicates based on URI
    activeFiles.forEach((activeFile: { name: string; type: string; uri: string }) => {
      if (activeFile.uri && !combinedFilePartsMap.has(activeFile.uri)) {
        combinedFilePartsMap.set(activeFile.uri, {
          fileData: {
            mimeType: activeFile.type,
            fileUri: activeFile.uri,
          }
        });
      }
    });

    // Add the unique file parts to the current user message
    currentUserParts.push(...Array.from(combinedFilePartsMap.values()));

    // Log history and current message parts for debugging
    currentUserParts.forEach((part, index) => {
      if ('text' in part) console.log(`Part ${index}: Text`);
      if ('fileData' in part && part.fileData) {
      }
    });
    
    // Ensure there's at least one part to send
    if (currentUserParts.length === 0) {
       console.warn("No parts to send in the current user message. Adding placeholder text.");
       currentUserParts.push({ text: "(User provided no text or files)" });
    }

    // Create a streaming response
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            // Send uploaded file metadata back first (For Step 1)
            if (uploadedFileMetadata.length > 0) {
              const fileEvent = {
                type: 'file_uploaded',
                data: uploadedFileMetadata // Send array of all uploaded files info
              };
              controller.enqueue(encoder.encode(JSON.stringify(fileEvent) + '\n'));
            }

            // Send the message and get streaming response
            
            // Call generateContentStream directly on genAI.models
            const streamingResponse = await genAI.models.generateContentStream({
              model: actualModelName, // Pass model name directly
              contents: [
                ...historyMessages, // Spread the history messages
                { role: 'user', parts: currentUserParts } // Add current user message parts
              ],
              // generationConfig and safetySettings removed based on linter error
            });
            
            // Iterate directly over the async generator result
            for await (const chunk of streamingResponse) {
              // Handle potential errors in the chunk itself
              if (chunk.candidates && chunk.candidates[0]?.finishReason === 'SAFETY') {
                  console.warn("Gemini response blocked due to safety settings.");
                  const safetyMessage = {
                      choices: [{ delta: { content: "[Blocked due to safety settings]" } }]
                  };
                  controller.enqueue(encoder.encode(JSON.stringify(safetyMessage) + '\n'));
                  break; // Stop processing this stream
              }
              if (chunk.candidates && chunk.candidates[0]?.finishReason === 'RECITATION') {
                  console.warn("Gemini response blocked due to recitation.");
                  const recitationMessage = {
                      choices: [{ delta: { content: "[Blocked due to recitation]" } }]
                  };
                  controller.enqueue(encoder.encode(JSON.stringify(recitationMessage) + '\n'));
                  break; // Stop processing this stream
              }

              // Access text property directly and check for existence
              const text = chunk?.text; 
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

            // Note: Immediate file deletion was removed.
            // Files are automatically deleted by the API after 48 hours.

          } catch (error: any) {
            console.error('Error in Google AI stream processing:', error);
            
            // If there's an issue with the message format, log it more clearly
            if (error.toString().includes('part') || error.toString().includes('Content')) {
              console.error('Message parts error details:', {
                currentUserPartsCount: currentUserParts?.length || 0,
                hasTextPart: currentUserParts?.some((part: any) => 'text' in part),
                hasFilePart: currentUserParts?.some((part: any) => 'fileData' in part),
                firstPartType: currentUserParts?.[0] 
                  ? ('text' in currentUserParts[0] ? 'text' : 'fileData')
                  : 'none'
              });
            }
            
            // Check if it's a model not found error
            const errorMsg = error.toString();
            if (errorMsg.includes('not found') || errorMsg.includes('404')) {
              // Get real-time list of available models if possible
              let availableModels = AVAILABLE_MODELS; // Fallback
              // Listing models is not directly available in the new SDK client-side
              // We'll rely on our predefined list for the error message.
              
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
            } else if (errorMsg.includes('part') || errorMsg.includes('Content') || errorMsg.includes('fileData') || errorMsg.includes('fileUri')) {
              // Handle message parts or file errors
              const errorResponse = {
                choices: [
                  {
                    delta: {
                      content: `Error: There was an issue processing your message or files. Please ensure files are under the size limit and try again.`
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
  genAI: GoogleGenAI,
  modelName: string, 
  prompt: string, 
  messages: any[]
) {
  // --- START DEBUG LOGGING ---
  // --- END DEBUG LOGGING ---
  try {
    
    // @ts-ignore - Suppress TS error, prioritizing runtime fix based on logs.
    // Will call generateContent directly on genAI.models for image generation

    // Generate content - structure might be slightly different with the new SDK
    const generationResponse = await genAI.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      // Pass safetySettings and responseModalities within the config object
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
        safetySettings: safetySettings 
      }
    }); 


    // Check for prompt feedback (overall safety assessment)
    if (generationResponse.promptFeedback) {
      console.warn('Prompt Feedback:', JSON.stringify(generationResponse.promptFeedback, null, 2));
      if (generationResponse.promptFeedback.blockReason) {
        // If the whole prompt was blocked, return an error early
        return new Response(
          JSON.stringify({
            error: `Prompt blocked: ${generationResponse.promptFeedback.blockReason}`,
            message: `Your request was blocked due to safety concerns (${generationResponse.promptFeedback.blockReason}). Please modify your prompt.`,
            text: `Your request was blocked due to safety concerns (${generationResponse.promptFeedback.blockReason}). Please modify your prompt.`,
            images: []
          }),
          { status: 400 } // Bad Request because the prompt was bad
        );
      }
    }
    // --- END DEBUG LOGGING ---


    // Process the response - adjust based on the new SDK's response structure
    // Access data directly from the response object
    const candidate = generationResponse.candidates?.[0]; 

    // --- START DEBUG LOGGING ---
    if (candidate) {
        

        // Check if the candidate was stopped due to safety
        if (candidate.finishReason === 'SAFETY') {
             return new Response(
              JSON.stringify({
                error: 'Content blocked due to safety settings',
                message: 'The generated content was blocked due to safety settings. Please try a different prompt.',
                text: 'The generated content was blocked due to safety settings. Please try a different prompt.',
                images: []
              }),
              { status: 400 } // Bad Request due to generated content
            );
        }
        if (candidate.finishReason === 'RECITATION') {
             return new Response(
              JSON.stringify({
                error: 'Content blocked due to recitation',
                message: 'The generated content was blocked due to potential recitation. Please try a different prompt.',
                text: 'The generated content was blocked due to potential recitation. Please try a different prompt.',
                images: []
              }),
              { status: 400 } 
            );
        }
    }
     // --- END DEBUG LOGGING ---


    if (!candidate || !candidate.content || !candidate.content.parts) {
        console.error('Unexpected image generation response structure:', generationResponse);
        throw new Error("Invalid response structure from image generation model");
    }

    // Log the response structure to help debug (adjust based on new SDK)
  
    // Format the response for the client
    interface ImageData {
      mimeType: string;
      data: string; // Base64 data or URL
      url?: string | null; 
    }
    
    const formattedResponse: {
      text: string;
      images: ImageData[];
    } = {
      text: '',
      images: []
    };

    // Extract text and images from response parts (adjust based on new SDK)
    const imagesForProcessing: ImageData[] = [];
    
    for (const part of candidate.content.parts) {
        if (part.text) {
            formattedResponse.text += part.text;
        } else if (part.inlineData) { // Check if inlineData is still used
            // Ensure the image data is valid
            try {
                if (!part.inlineData.data) {
                    console.error('Image data is missing in response part');
                    continue;
                }
                
                let imageData = part.inlineData.data;
                if (imageData.startsWith('data:')) {
                    const commaIndex = imageData.indexOf(',');
                    if (commaIndex !== -1) imageData = imageData.substring(commaIndex + 1);
                }
                
                // Simple validation (not full base64 check)
                if (imageData.length < 10) {
                    console.error('Potentially invalid base64 data received');
                    continue;
                }

                imagesForProcessing.push({
                    mimeType: part.inlineData.mimeType || 'image/png',
                    data: imageData
                });

            } catch (err) {
                console.error('Invalid image data in response:', err);
            }
        } else if (part.fileData) { // Handle fileData if the model returns URIs
            console.warn("Image generation returned fileData, which is unexpected. Ignoring.", part.fileData);
            // Potentially fetch the file URI if needed, but likely an error state.
        }
    }

    
    if (imagesForProcessing.length === 0 && formattedResponse.text.length === 0) {
        console.warn('No text or processable image data found in the Gemini response.');
        // Fallback text is handled later
    } else {
        console.log('Images data sizes:', imagesForProcessing.map(img => img.data.length));
    }
    
    // Upload images to Supabase
    let processedImages: (ImageData | null)[] = [];
    if (imagesForProcessing.length > 0) {
        try {
            const uploadPromises = imagesForProcessing.map(img => processImageData(img));
            processedImages = await Promise.all(uploadPromises);
            console.log('Images processing complete:', processedImages.map(img => img ? !!img.url : null));
        } catch (error) {
            console.error('Error during image processing:', error);
        }
        
        // Add processed images to response, filtering out nulls
        formattedResponse.images = processedImages.filter(img => img !== null) as ImageData[];
    }
    
    // If no images or text were found, provide fallback content
    if (formattedResponse.images.length === 0 && formattedResponse.text.length === 0) {
      formattedResponse.text = "I attempted to generate content based on your request, but wasn't able to create text or an image. This might be due to content safety policies or technical limitations. Please try again with a different description.";
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