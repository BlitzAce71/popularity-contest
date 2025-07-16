import React, { useState, useRef } from 'react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Plus, AlertCircle, Upload, X } from 'lucide-react';
import { ImageUploadService } from '@/utils/imageUpload';
import type { SubmitSuggestionRequest } from '@/types';

interface SuggestionFormProps {
  onSubmit: (data: SubmitSuggestionRequest) => Promise<boolean>;
  loading?: boolean;
  className?: string;
}

const SuggestionForm: React.FC<SuggestionFormProps> = ({
  onSubmit,
  loading = false,
  className = '',
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_url: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'name':
        if (!value.trim()) return 'Suggestion name is required';
        if (value.length > 255) return 'Name must be 255 characters or less';
        if (!/^[a-zA-Z0-9\s\-'\.]+$/.test(value)) {
          return 'Name can only contain letters, numbers, spaces, hyphens, apostrophes, and periods';
        }
        return '';
      
      case 'description':
        if (value && value.length > 1000) return 'Description must be 1000 characters or less';
        return '';
      
      case 'image_url':
        if (value && !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(value)) {
          return 'Image URL must be a valid image file (jpg, png, gif, webp)';
        }
        return '';
      
      default:
        return '';
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field as keyof typeof formData]);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear any existing preview
    if (previewUrl) {
      ImageUploadService.revokePreviewUrl(previewUrl);
    }

    // Create preview
    const preview = ImageUploadService.createPreviewUrl(file);
    setPreviewUrl(preview);
    setUploadedFile(file);

    // Clear image_url field since we're using file upload
    setFormData(prev => ({ ...prev, image_url: '' }));
    setErrors(prev => ({ ...prev, image_url: '' }));
  };

  const handleRemoveFile = () => {
    if (previewUrl) {
      ImageUploadService.revokePreviewUrl(previewUrl);
    }
    setPreviewUrl('');
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageUrlChange = (value: string) => {
    // If user types URL, clear file upload
    if (value && uploadedFile) {
      handleRemoveFile();
    }
    handleInputChange('image_url', value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const newErrors: Record<string, string> = {};
    Object.keys(formData).forEach(field => {
      const error = validateField(field, formData[field as keyof typeof formData]);
      if (error) newErrors[field] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched({ name: true, description: true, image_url: true });
      return;
    }

    let finalImageUrl = formData.image_url.trim();

    // Upload file if one is selected
    if (uploadedFile) {
      setUploadLoading(true);
      try {
        const uploadResult = await ImageUploadService.uploadImage(uploadedFile, {
          bucket: 'contestant-images',
          folder: 'suggestions'
        });

        if (!uploadResult.success) {
          setErrors({ image_url: uploadResult.error || 'Failed to upload image' });
          return;
        }

        finalImageUrl = uploadResult.url || '';
      } catch (error) {
        setErrors({ image_url: 'Failed to upload image' });
        return;
      } finally {
        setUploadLoading(false);
      }
    }

    // Submit the form
    const success = await onSubmit({
      tournament_id: '', // This will be set by the parent component
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      image_url: finalImageUrl || undefined,
    });

    // Clear form on successful submission
    if (success) {
      setFormData({ name: '', description: '', image_url: '' });
      setErrors({});
      setTouched({});
      handleRemoveFile();
    }
  };

  const isFormValid = () => {
    return formData.name.trim() && Object.values(errors).every(error => !error);
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Plus className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Submit New Suggestion</h3>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Field */}
        <div>
          <label htmlFor="suggestion-name" className="block text-sm font-medium text-gray-700 mb-1">
            Contestant Name *
          </label>
          <input
            id="suggestion-name"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            onBlur={() => handleBlur('name')}
            placeholder="Enter contestant name..."
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              touched.name && errors.name 
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-300'
            }`}
            disabled={loading}
            maxLength={255}
            required
          />
          {touched.name && errors.name && (
            <div className="flex items-center gap-1 mt-1">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600">{errors.name}</span>
            </div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            {formData.name.length}/255 characters
          </div>
        </div>

        {/* Description Field */}
        <div>
          <label htmlFor="suggestion-description" className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <textarea
            id="suggestion-description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            onBlur={() => handleBlur('description')}
            placeholder="Add a brief description..."
            rows={3}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none ${
              touched.description && errors.description 
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-300'
            }`}
            disabled={loading}
            maxLength={1000}
          />
          {touched.description && errors.description && (
            <div className="flex items-center gap-1 mt-1">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600">{errors.description}</span>
            </div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            {formData.description.length}/1000 characters
          </div>
        </div>

        {/* Image Upload/URL Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Image (optional)
          </label>
          
          {/* Upload Button */}
          <div className="flex items-center gap-4 mb-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || uploadLoading}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {uploadLoading ? 'Uploading...' : 'Upload Image'}
            </Button>
            <span className="text-sm text-gray-500">or enter URL below</span>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* URL input */}
          <input
            id="suggestion-image"
            type="url"
            value={formData.image_url}
            onChange={(e) => handleImageUrlChange(e.target.value)}
            onBlur={() => handleBlur('image_url')}
            placeholder="https://example.com/image.jpg"
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              touched.image_url && errors.image_url 
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-300'
            }`}
            disabled={loading || uploadLoading || !!uploadedFile}
          />
          
          {touched.image_url && errors.image_url && (
            <div className="flex items-center gap-1 mt-1">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600">{errors.image_url}</span>
            </div>
          )}
          
          <div className="text-xs text-gray-500 mt-1">
            Upload: JPG, PNG, WebP (max 5MB) • URL: Direct image links
          </div>
        </div>

        {/* File Preview */}
        {(previewUrl || (formData.image_url && !errors.image_url)) && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Preview</label>
              {uploadedFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  className="text-red-600 hover:text-red-800 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Remove
                </Button>
              )}
            </div>
            <div className="relative w-32 h-32 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <img
                src={previewUrl || formData.image_url}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  if (!uploadedFile) {
                    setErrors(prev => ({ ...prev, image_url: 'Failed to load image' }));
                  }
                }}
              />
            </div>
          </div>
        )}


        {/* Submit Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <Button
            type="submit"
            disabled={!isFormValid() || loading || uploadLoading}
            className="flex items-center gap-2 min-w-[140px] justify-center"
          >
            {loading || uploadLoading ? (
              <>
                <LoadingSpinner size="sm" />
                {uploadLoading ? 'Uploading...' : 'Submitting...'}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Submit Suggestion
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SuggestionForm;