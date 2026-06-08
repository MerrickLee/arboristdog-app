-- 1. Create a public bucket for diagnosis images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('diagnosis-images', 'diagnosis-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up RLS Policies for the bucket
-- Allow authenticated users to upload their own images
DROP POLICY IF EXISTS "Users can upload their own diagnosis images" ON storage.objects;
CREATE POLICY "Users can upload their own diagnosis images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'diagnosis-images' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to view their own images
DROP POLICY IF EXISTS "Users can view their own diagnosis images" ON storage.objects;
CREATE POLICY "Users can view their own diagnosis images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'diagnosis-images' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public access for now if you want arborists to see them via shared links
-- (Or keep it restricted and use signed URLs in your Zapier integration)
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'diagnosis-images');
