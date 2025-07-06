-- Configure Supabase Storage buckets for contestant and tournament images
-- This sets up secure image storage with proper access controls

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
        'contestant-images',
        'contestant-images',
        true,
        5242880, -- 5MB limit
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    ),
    (
        'tournament-images',
        'tournament-images', 
        true,
        5242880, -- 5MB limit
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    ),
    (
        'user-avatars',
        'user-avatars',
        true,
        2097152, -- 2MB limit
        ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- CONTESTANT IMAGES BUCKET POLICIES
-- ============================================================================

-- Allow public viewing of contestant images
CREATE POLICY "Anyone can view contestant images" ON storage.objects
    FOR SELECT USING (bucket_id = 'contestant-images');

-- Allow authenticated users to upload contestant images
CREATE POLICY "Authenticated users can upload contestant images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'contestant-images' AND
        auth.role() = 'authenticated'
    );

-- Allow tournament creators to manage images for their contestants
CREATE POLICY "Creators can manage contestant images" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'contestant-images' AND
        EXISTS (
            SELECT 1 FROM public.contestants c
            JOIN public.tournaments t ON c.tournament_id = t.id
            WHERE c.image_url = storage.objects.name AND t.created_by = auth.uid()
        )
    );

CREATE POLICY "Creators can delete contestant images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'contestant-images' AND
        EXISTS (
            SELECT 1 FROM public.contestants c
            JOIN public.tournaments t ON c.tournament_id = t.id
            WHERE c.image_url = storage.objects.name AND t.created_by = auth.uid()
        )
    );

-- Admins can manage all contestant images
CREATE POLICY "Admins can manage all contestant images" ON storage.objects
    FOR ALL USING (
        bucket_id = 'contestant-images' AND
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- ============================================================================
-- TOURNAMENT IMAGES BUCKET POLICIES
-- ============================================================================

-- Allow public viewing of tournament images
CREATE POLICY "Anyone can view tournament images" ON storage.objects
    FOR SELECT USING (bucket_id = 'tournament-images');

-- Allow authenticated users to upload tournament images
CREATE POLICY "Authenticated users can upload tournament images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'tournament-images' AND
        auth.role() = 'authenticated'
    );

-- Allow tournament creators to manage their tournament images
CREATE POLICY "Creators can manage tournament images" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'tournament-images' AND
        EXISTS (
            SELECT 1 FROM public.tournaments
            WHERE image_url = storage.objects.name AND created_by = auth.uid()
        )
    );

CREATE POLICY "Creators can delete tournament images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'tournament-images' AND
        EXISTS (
            SELECT 1 FROM public.tournaments
            WHERE image_url = storage.objects.name AND created_by = auth.uid()
        )
    );

-- Admins can manage all tournament images
CREATE POLICY "Admins can manage all tournament images" ON storage.objects
    FOR ALL USING (
        bucket_id = 'tournament-images' AND
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- ============================================================================
-- USER AVATARS BUCKET POLICIES
-- ============================================================================

-- Allow public viewing of user avatars
CREATE POLICY "Anyone can view user avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'user-avatars');

-- Allow users to upload their own avatars
CREATE POLICY "Users can upload own avatars" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'user-avatars' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow users to update their own avatars
CREATE POLICY "Users can update own avatars" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'user-avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete own avatars" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'user-avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Admins can manage all user avatars
CREATE POLICY "Admins can manage all user avatars" ON storage.objects
    FOR ALL USING (
        bucket_id = 'user-avatars' AND
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS FOR STORAGE
-- ============================================================================

-- Function to generate unique filename with timestamp
CREATE OR REPLACE FUNCTION public.generate_unique_filename(original_filename TEXT, file_extension TEXT)
RETURNS TEXT AS $$
DECLARE
    timestamp_str TEXT;
    random_str TEXT;
    clean_filename TEXT;
BEGIN
    -- Get current timestamp
    timestamp_str := TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');
    
    -- Generate random string
    random_str := substr(md5(random()::text), 1, 8);
    
    -- Clean original filename (remove extension and special characters)
    clean_filename := regexp_replace(
        split_part(original_filename, '.', 1),
        '[^a-zA-Z0-9_-]',
        '_',
        'g'
    );
    
    -- Combine parts
    RETURN clean_filename || '_' || timestamp_str || '_' || random_str || '.' || file_extension;
END;
$$ LANGUAGE plpgsql;

-- Function to get storage URL for a bucket and path
CREATE OR REPLACE FUNCTION public.get_storage_url(bucket_name TEXT, file_path TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN concat(
        current_setting('app.settings.supabase_url', true),
        '/storage/v1/object/public/',
        bucket_name,
        '/',
        file_path
    );
END;
$$ LANGUAGE plpgsql;

-- Function to validate image file type
CREATE OR REPLACE FUNCTION public.validate_image_type(filename TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    file_extension TEXT;
    allowed_extensions TEXT[] := ARRAY['jpg', 'jpeg', 'png', 'webp', 'gif'];
BEGIN
    file_extension := lower(split_part(filename, '.', -1));
    RETURN file_extension = ANY(allowed_extensions);
END;
$$ LANGUAGE plpgsql;

-- Function to clean up orphaned storage files
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_images()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    file_record RECORD;
BEGIN
    -- Find contestant images not referenced in database
    FOR file_record IN
        SELECT name FROM storage.objects
        WHERE bucket_id = 'contestant-images'
        AND name NOT IN (
            SELECT image_url FROM public.contestants 
            WHERE image_url IS NOT NULL
        )
    LOOP
        DELETE FROM storage.objects 
        WHERE bucket_id = 'contestant-images' AND name = file_record.name;
        deleted_count := deleted_count + 1;
    END LOOP;
    
    -- Find tournament images not referenced in database
    FOR file_record IN
        SELECT name FROM storage.objects
        WHERE bucket_id = 'tournament-images'
        AND name NOT IN (
            SELECT image_url FROM public.tournaments 
            WHERE image_url IS NOT NULL
        )
    LOOP
        DELETE FROM storage.objects 
        WHERE bucket_id = 'tournament-images' AND name = file_record.name;
        deleted_count := deleted_count + 1;
    END LOOP;
    
    -- Find user avatars not referenced in database
    FOR file_record IN
        SELECT name FROM storage.objects
        WHERE bucket_id = 'user-avatars'
        AND name NOT IN (
            SELECT avatar_url FROM public.users 
            WHERE avatar_url IS NOT NULL
        )
    LOOP
        DELETE FROM storage.objects 
        WHERE bucket_id = 'user-avatars' AND name = file_record.name;
        deleted_count := deleted_count + 1;
    END LOOP;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON FUNCTION public.generate_unique_filename(TEXT, TEXT) IS 'Generate unique filename with timestamp and random string';
COMMENT ON FUNCTION public.get_storage_url(TEXT, TEXT) IS 'Get full storage URL for a bucket and file path';
COMMENT ON FUNCTION public.validate_image_type(TEXT) IS 'Validate if filename has allowed image extension';
COMMENT ON FUNCTION public.cleanup_orphaned_images() IS 'Remove storage files not referenced in database';