import { createClient } from '@supabase/supabase-js';
import { generateUniqueImageName } from './utils';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Use service role key for server-side operations to bypass RLS policies
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Log Supabase configuration
console.log('Supabase Configuration:', {
  hasUrl: !!supabaseUrl,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  usingServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 15) + '...' : 'missing'
});

const supabase = createClient(supabaseUrl, supabaseKey);

// Export the bucket name as a constant for consistency
export const BUCKET_NAME = 'ai-generated-images';

/**
 * Upload a base64 image to Supabase storage
 * @param base64Data The base64 image data (without the data:image/xxx;base64, prefix)
 * @param mimeType The MIME type of the image
 * @returns URL of the uploaded image or null if upload failed
 */
export async function uploadImageToSupabase(base64Data: string, mimeType: string = 'image/png'): Promise<string | null> {
  try {
    // Log the upload attempt
    console.log(`🚀 Attempting to upload image to Supabase: ${BUCKET_NAME}`);
    
    // Verify we have base64 data
    if (!base64Data || base64Data.length < 10) {
      console.error('❌ Invalid base64 data provided to uploadImageToSupabase');
      return null;
    }
    
    // Convert base64 to binary data
    let binaryData: Buffer;
    try {
      binaryData = Buffer.from(base64Data, 'base64');
      console.log(`✅ Successfully converted base64 to binary data (${binaryData.length} bytes)`);
    } catch (error) {
      console.error('❌ Failed to convert base64 to binary:', error);
      return null;
    }
    
    // Create a unique filename
    const filename = `${generateUniqueImageName()}.png`;
    console.log(`📄 Generated filename: ${filename}`);
    
    // Verify bucket exists before upload
    try {
      const { data: bucketData, error: bucketError } = await supabase.storage
        .getBucket(BUCKET_NAME);
      
      if (bucketError) {
        console.error(`❌ Error checking bucket existence: ${bucketError.message}`);
        if (bucketError.message.includes('does not exist')) {
          console.error(`🚨 Bucket '${BUCKET_NAME}' doesn't exist. Please create it in the Supabase dashboard.`);
          return null;
        }
      } else {
        console.log(`✅ Bucket '${BUCKET_NAME}' exists`);
      }
    } catch (error) {
      console.error('❌ Exception checking bucket:', error);
    }
    
    // Upload to Supabase storage
    console.log(`📤 Uploading to ${BUCKET_NAME}/images/${filename}`);
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(`images/${filename}`, binaryData, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('❌ Error uploading image to Supabase:', error);
      // Additional debug for policy errors
      if (error.message?.includes('policy')) {
        console.error(`🔐 This appears to be a permissions issue. Make sure:
          1. You've created the bucket '${BUCKET_NAME}' in Supabase
          2. You've run the SQL in supabase-storage.sql to set up policies
          3. The service role key is being correctly used to bypass RLS`);
      }
      return null;
    }
    
    console.log('✅ Image successfully uploaded to Supabase');
    
    // Get the public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(`images/${filename}`);
    
    console.log(`🔗 Generated public URL: ${publicUrl}`);
    
    return publicUrl;
  } catch (error) {
    console.error('❌ Exception in uploadImageToSupabase:', error);
    return null;
  }
}

/**
 * Determine if a string is a Supabase storage URL
 */
export function isSupabaseStorageUrl(url: string): boolean {
  return url.includes(supabaseUrl) && url.includes(BUCKET_NAME);
}

/**
 * Process image data - either upload to Supabase or return as is if already a URL
 */
export async function processImageData(
  imageData: { mimeType: string; data: string }
): Promise<{ mimeType: string; data: string; url: string | null }> {
  console.log('🔄 Processing image data');
  
  // Log image data type and presence
  console.log('📄 Image data details:', {
    hasMimeType: !!imageData.mimeType,
    mimeType: imageData.mimeType || 'missing',
    hasData: !!imageData.data,
    dataLength: imageData.data?.length || 0,
    dataPrefix: imageData.data ? imageData.data.substring(0, 30) + '...' : 'missing',
    isDataUrl: imageData.data?.startsWith('http') || false
  });
  
  try {
    // If the data is already a URL, return it as is
    if (imageData.data.startsWith('http')) {
      console.log('🔗 Image data is already a URL, returning as is');
      return { ...imageData, url: imageData.data };
    }
    
    // Upload to Supabase and get the URL
    console.log('📤 Uploading image to Supabase...');
    const url = await uploadImageToSupabase(imageData.data, imageData.mimeType);
    
    if (!url) {
      console.error('❌ Failed to upload to Supabase, returning original data');
      return { ...imageData, url: null };
    }
    
    console.log(`✅ Successfully processed image, returning with URL: ${url}`);
    
    // Return both the base64 data (for immediate display) and the URL (for storage)
    return {
      ...imageData,
      url
    };
  } catch (error) {
    console.error('❌ Exception in processImageData:', error);
    // In case of error, return the original data without a URL
    return { ...imageData, url: null };
  }
} 