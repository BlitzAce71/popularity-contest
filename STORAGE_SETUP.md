# 🗂️ Supabase Storage Setup Guide

This guide covers setting up storage buckets for the Popularity Contest application.

## 📋 Storage Buckets Overview

The application requires 3 storage buckets:

1. **`tournament-images`** - Public bucket for tournament banner images
2. **`contestant-images`** - Public bucket for contestant photos  
3. **`user-avatars`** - Private bucket for user profile pictures

## 🚀 Automatic Setup (Recommended)

The storage buckets should be automatically created when you run the `COMPLETE_MIGRATION.sql` script. 

### Verify Buckets Exist

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to **Storage**
3. Check that these 3 buckets exist:
   - ✅ `tournament-images`
   - ✅ `contestant-images` 
   - ✅ `user-avatars`

## 🔧 Manual Setup (If Needed)

If the buckets weren't created automatically, follow these steps:

### Step 1: Create Buckets

Go to **Storage** → **New bucket** for each:

#### Tournament Images Bucket
- **Name**: `tournament-images`
- **Public**: ✅ Yes
- **File size limit**: 5MB
- **Allowed MIME types**: `image/jpeg,image/jpg,image/png,image/webp`

#### Contestant Images Bucket  
- **Name**: `contestant-images`
- **Public**: ✅ Yes
- **File size limit**: 5MB
- **Allowed MIME types**: `image/jpeg,image/jpg,image/png,image/webp`

#### User Avatars Bucket
- **Name**: `user-avatars` 
- **Public**: ❌ No
- **File size limit**: 2MB
- **Allowed MIME types**: `image/jpeg,image/jpg,image/png,image/webp`

### Step 2: Configure Bucket Policies

Go to **Storage** → **Policies** and create these policies:

#### Tournament Images Policies

```sql
-- Public read access
CREATE POLICY "Tournament images are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'tournament-images');

-- Authenticated upload
CREATE POLICY "Authenticated users can upload tournament images" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'tournament-images' 
    AND auth.role() = 'authenticated'
);

-- User can update their own uploads
CREATE POLICY "Users can update tournament images they uploaded" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'tournament-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- User can delete their own uploads
CREATE POLICY "Users can delete tournament images they uploaded" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'tournament-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
```

#### Contestant Images Policies

```sql
-- Public read access
CREATE POLICY "Contestant images are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'contestant-images');

-- Authenticated upload
CREATE POLICY "Authenticated users can upload contestant images" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'contestant-images' 
    AND auth.role() = 'authenticated'
);

-- User can update their own uploads
CREATE POLICY "Users can update contestant images they uploaded" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'contestant-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- User can delete their own uploads
CREATE POLICY "Users can delete contestant images they uploaded" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'contestant-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
```

#### User Avatars Policies

```sql
-- Private access - users can only see their own
CREATE POLICY "Users can view their own avatars" 
ON storage.objects FOR SELECT 
USING (
    bucket_id = 'user-avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- User can upload their own avatar
CREATE POLICY "Users can upload their own avatars" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'user-avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- User can update their own avatar
CREATE POLICY "Users can update their own avatars" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'user-avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- User can delete their own avatar
CREATE POLICY "Users can delete their own avatars" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'user-avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
```

## 📁 Folder Structure

The application will organize files in these buckets as follows:

### Tournament Images
```
tournament-images/
├── {user_id}/
│   ├── tournament_{tournament_id}_banner.jpg
│   ├── tournament_{tournament_id}_logo.png
│   └── ...
```

### Contestant Images  
```
contestant-images/
├── {user_id}/
│   ├── contestant_{contestant_id}_photo.jpg
│   ├── contestant_{contestant_id}_alt.png
│   └── ...
```

### User Avatars
```
user-avatars/
├── {user_id}/
│   ├── avatar_{timestamp}.jpg
│   ├── avatar_{timestamp}.png
│   └── ...
```

## 🧪 Testing Storage Setup

### Test 1: Upload a Test File

Try uploading a test image through the Supabase dashboard:

1. Go to **Storage** → `tournament-images`
2. Click **Upload file**
3. Upload any image file
4. Verify it appears in the bucket

### Test 2: Test Public Access

For public buckets, get the public URL:

1. Click on an uploaded file
2. Click **Get public URL** 
3. Open the URL in a new tab
4. Verify the image loads

### Test 3: Test Policies

Run this in SQL Editor to check policies:

```sql
-- Check storage policies
SELECT 
    schemaname,
    tablename, 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;
```

## 🔧 Configuration in Application

The application uses these environment variables for storage:

```env
# Already configured in your .env.local
VITE_SUPABASE_URL=https://swinznpmsszgnhgjipvk.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Optional: Custom file size limits
VITE_MAX_FILE_SIZE=5
```

## 📝 File Upload Validation

The application enforces these restrictions:

### Tournament Images
- **Max size**: 5MB
- **Formats**: JPEG, JPG, PNG, WebP
- **Dimensions**: Recommended 1200x630px for social sharing

### Contestant Images
- **Max size**: 5MB  
- **Formats**: JPEG, JPG, PNG, WebP
- **Dimensions**: Recommended square format (e.g., 400x400px)

### User Avatars
- **Max size**: 2MB
- **Formats**: JPEG, JPG, PNG, WebP  
- **Dimensions**: Recommended square format (e.g., 200x200px)

## ❌ Troubleshooting

### Common Issues

**Issue: "Bucket not found"**
- Solution: Verify bucket name spelling
- Check bucket exists in Storage dashboard

**Issue: "Policy violation" errors**  
- Solution: Check RLS policies are correctly applied
- Verify user is authenticated

**Issue: "File too large"**
- Solution: Check file size limits
- Compress images before upload

**Issue: "Invalid file type"**
- Solution: Ensure file is supported image format
- Check file extension matches content type

### Policy Debugging

Check if policies are working:

```sql
-- Test policy for tournament images
SELECT policy_name, cmd, permissive, roles, qual 
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policy_name LIKE '%tournament%';
```

### Clear Storage (If Needed)

To reset storage during development:

```sql
-- WARNING: This deletes all files!

-- Delete all objects in buckets
DELETE FROM storage.objects 
WHERE bucket_id IN (
    'tournament-images', 
    'contestant-images', 
    'user-avatars'
);

-- Delete buckets (optional)
DELETE FROM storage.buckets 
WHERE id IN (
    'tournament-images', 
    'contestant-images', 
    'user-avatars'
);
```

## 🔐 Security Considerations

### Best Practices

1. **File Validation**: Application validates file types and sizes
2. **User Isolation**: Files are organized by user ID folders  
3. **Access Control**: Private buckets restrict access to file owners
4. **Public Safety**: Public buckets only allow image files

### Content Moderation

Consider implementing:
- Image content scanning for inappropriate content
- File name sanitization  
- Rate limiting for uploads
- Virus scanning for uploaded files

## ✅ Verification Checklist

After setup, verify:

### Buckets
- [ ] `tournament-images` bucket created (public)
- [ ] `contestant-images` bucket created (public)
- [ ] `user-avatars` bucket created (private)

### Policies  
- [ ] Public read policies for public buckets
- [ ] User upload policies for all buckets
- [ ] User management policies (update/delete)
- [ ] Privacy policies for user avatars

### Testing
- [ ] File upload works through application
- [ ] Public URLs work for public buckets
- [ ] Private access works for user avatars
- [ ] File size limits enforced
- [ ] File type validation works

## 🔄 Next Steps

After storage setup:

1. **Test Application Uploads**
   - Start development server: `npm run dev`
   - Try uploading tournament/contestant images
   - Test user avatar upload

2. **Monitor Usage**
   - Check **Storage** dashboard for usage stats
   - Monitor for any policy violations in logs

3. **Optimize Performance**
   - Consider CDN for public images
   - Implement image resizing/optimization

---

**Storage Setup Complete!** 🎉 Your Supabase storage is now ready for file uploads.