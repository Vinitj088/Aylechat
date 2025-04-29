import { NextRequest } from 'next/server';
import Together from "together-ai";
import { processImageData } from '@/lib/supabase';
import { ImageData } from '@/app/types';

// Ensure route is always dynamic
export const dynamic = 'force-dynamic';

// Pre-define constants and encoder outside the handler for better performance
const encoder = new TextEncoder();

// Handle warmup requests specially
const handleWarmup = () => {
  return new Response(
    JSON.stringify({ status: 'warmed_up' }),
    { status: 200 }
  );
};

// Define models for together AI image generation
const IMAGE_GENERATION_MODELS = [
  'black-forest-labs/FLUX.1-schnell-Free',
];

export async function POST(req: NextRequest) {
  // Handle warmup requests if present
  const isWarmup = req.headers.get('x-vercel-warmup');
  if (isWarmup) {
    return handleWarmup();
  }

  try {
    // Read request body
    const body = await req.json();
    const { model, prompt, query, dimensions } = body;
    
    // Use either prompt or query parameter
    const promptText = prompt || query;
    
    // Check for required parameters
    if (!model || !promptText) {
      return new Response(
        JSON.stringify({
          error: 'Missing required parameters',
          message: 'Model and prompt are required for image generation',
          text: 'Model and prompt are required for image generation',
          images: []
        }),
        { status: 400 }
      );
    }
    
    // Log the request parameters
    console.log("Together AI request:", { model, promptText, dimensions });
    
    // Get API key
    const API_KEY = process.env.TOGETHER_API_KEY;
    if (!API_KEY) {
      throw new Error('TOGETHER_API_KEY environment variable not set');
    }

    // Initialize Together API client
    const together = new Together({ apiKey: API_KEY });

    // Set dimensions (or use default)
    const width = dimensions?.width || 1024;
    const height = dimensions?.height || 768;

    // Generate the image
    const response = await together.images.create({
      model: model,
      prompt: promptText,
      width: width,
      height: height,
      steps: 4,
      n: 1,
      response_format: "base64",
    });

    // Debug the response structure
    console.log("Together AI response keys:", Object.keys(response));
    console.log("Together AI data keys:", response.data && response.data.length > 0 ? Object.keys(response.data[0]) : "No data");

    // Process the response
    if (!response.data || response.data.length === 0) {
      throw new Error('No image data returned from Together AI');
    }

    // Get the image data - first convert to string to inspect
    const responseDataStr = JSON.stringify(response.data[0]);
    console.log("First response data item:", responseDataStr.substring(0, 100) + "...");

    // Extract the base64 data - different models might use different keys
    let imageData = "";
    // Cast to any to avoid TypeScript errors while we explore the API response format
    const dataObj = response.data[0] as any;
    
    if (dataObj.b64_json) {
      imageData = dataObj.b64_json;
    } else if (dataObj.base64) {
      imageData = dataObj.base64;
    } else {
      // Fallback - just stringify the whole object
      console.log("Could not find expected base64 image data, using raw response");
      imageData = responseDataStr;
    }

    // Create the image object for processing
    const imagesForProcessing: ImageData[] = [{
      mimeType: 'image/png',
      data: imageData
    }];

    // Format the initial response
    const formattedResponse: {
      text: string;
      images: ImageData[];
    } = {
      text: promptText.length > 30 ? `Here is an image based on "${promptText.substring(0, 30)}..."` : `Here is an image based on "${promptText}"`,
      images: []
    };

    // Upload images to Supabase just like in the Gemini implementation
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
    
    // If no images were processed successfully, provide fallback content
    if (formattedResponse.images.length === 0) {
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
    console.error('Error generating image with Together AI:', error);
    
    // Check if it's a 404 error (model not available)
    if (error.toString().includes('404')) {
      return new Response(
        JSON.stringify({
          error: 'Model not available',
          message: "The image generation model is currently not available. Please try a different model.",
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
        message: "I apologize, but I couldn't generate the requested image. This might be due to technical issues.",
        text: "I wasn't able to generate an image due to a technical issue. Please try again with a different model or description.",
        images: []
      }),
      { status: 500 }
    );
  }
} 