-- This file contains SQL commands to set up the storage bucket and policies for image storage
-- Run this in the Supabase SQL Editor after creating the bucket via the web UI

-- First, ensure the ai-generated-images bucket exists (must also be created in the UI)
-- If you have not created the bucket yet, go to Storage in Supabase dashboard and create it

-- Remove any existing RLS policies for this bucket if needed
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload images" ON storage.objects;
DROP POLICY IF EXISTS "Allow service uploads" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to their own folder" ON storage.objects;

-- Add a policy to allow public read access to the ai-generated-images bucket
CREATE POLICY "Allow public read access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'ai-generated-images');

-- Add a policy to allow authenticated users to upload to the bucket
CREATE POLICY "Allow authenticated users to upload images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'ai-generated-images' 
  AND auth.role() = 'authenticated'
);

-- Add a policy to allow server-side uploads via service role
CREATE POLICY "Allow service uploads"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'ai-generated-images' 
  AND auth.role() = 'service_role'
);

-- Add a policy to allow authenticated users to update and delete their own objects
CREATE POLICY "Give users access to their own folder"
ON storage.objects
FOR UPDATE OR DELETE
USING (
  bucket_id = 'ai-generated-images' 
  AND (auth.uid() = owner OR auth.role() = 'service_role')
);

-- Make sure the bucket is set to public
UPDATE storage.buckets 
SET public = TRUE 
WHERE name = 'ai-generated-images';

-- Optionally, you may need to add CORS configuration for the bucket
-- This can typically be done through the Supabase dashboard 