import { supabase } from '@/lib/supabase';

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface UploadOptions {
  bucket: string;
  folder?: string;
  maxSizeInMB?: number;
  allowedTypes?: string[];
}

export class ImageUploadService {
  private static readonly DEFAULT_OPTIONS: UploadOptions = {
    bucket: 'contestant-images',
    folder: '',
    maxSizeInMB: 5,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  };

  /**
   * Upload an image file to Supabase Storage
   */
  static async uploadImage(
    file: File, 
    options: Partial<UploadOptions> = {}
  ): Promise<ImageUploadResult> {
    try {
      const opts = { ...this.DEFAULT_OPTIONS, ...options };

      // Validate file
      const validation = this.validateFile(file, opts);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      // Get current user
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return { success: false, error: 'Authentication required' };
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${user.user.id}/${opts.folder ? opts.folder + '/' : ''}suggestion_${timestamp}.${fileExt}`;

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from(opts.bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        return { success: false, error: `Upload failed: ${error.message}` };
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from(opts.bucket)
        .getPublicUrl(data.path);

      return { 
        success: true, 
        url: publicUrlData.publicUrl 
      };

    } catch (error) {
      console.error('Image upload error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      };
    }
  }

  /**
   * Validate file before upload
   */
  private static validateFile(file: File, options: UploadOptions): { isValid: boolean; error?: string } {
    // Check file size
    const maxBytes = options.maxSizeInMB! * 1024 * 1024;
    if (file.size > maxBytes) {
      return { 
        isValid: false, 
        error: `File size must be less than ${options.maxSizeInMB}MB` 
      };
    }

    // Check file type
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      return { 
        isValid: false, 
        error: 'File type not supported. Please use JPEG, PNG, or WebP images.' 
      };
    }

    return { isValid: true };
  }

  /**
   * Delete an uploaded image
   */
  static async deleteImage(url: string, bucket: string = 'contestant-images'): Promise<boolean> {
    try {
      // Extract path from URL
      const urlParts = url.split('/');
      const pathIndex = urlParts.findIndex(part => part === bucket);
      if (pathIndex === -1) {
        console.error('Invalid URL format');
        return false;
      }

      const path = urlParts.slice(pathIndex + 1).join('/');

      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        console.error('Delete error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Image delete error:', error);
      return false;
    }
  }

  /**
   * Create a preview URL for a file before upload
   */
  static createPreviewUrl(file: File): string {
    return URL.createObjectURL(file);
  }

  /**
   * Cleanup preview URL when no longer needed
   */
  static revokePreviewUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}