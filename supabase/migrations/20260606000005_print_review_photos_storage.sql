-- OMO-2406: print-review-photos Supabase Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'print-review-photos',
  'print-review-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "print_review_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'print-review-photos');

CREATE POLICY "print_review_photos_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'print-review-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "print_review_photos_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'print-review-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
