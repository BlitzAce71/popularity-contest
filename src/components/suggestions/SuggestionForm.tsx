import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Plus, AlertCircle } from 'lucide-react';
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

    // Submit the form
    const success = await onSubmit({
      tournament_id: '', // This will be set by the parent component
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      image_url: formData.image_url.trim() || undefined,
    });

    // Clear form on successful submission
    if (success) {
      setFormData({ name: '', description: '', image_url: '' });
      setErrors({});
      setTouched({});
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

        {/* Image URL Field */}
        <div>
          <label htmlFor="suggestion-image" className="block text-sm font-medium text-gray-700 mb-1">
            Image URL (optional)
          </label>
          <input
            id="suggestion-image"
            type="url"
            value={formData.image_url}
            onChange={(e) => handleInputChange('image_url', e.target.value)}
            onBlur={() => handleBlur('image_url')}
            placeholder="https://example.com/image.jpg"
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              touched.image_url && errors.image_url 
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-300'
            }`}
            disabled={loading}
          />
          {touched.image_url && errors.image_url && (
            <div className="flex items-center gap-1 mt-1">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600">{errors.image_url}</span>
            </div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            Supported formats: JPG, PNG, GIF, WebP
          </div>
        </div>

        {/* Image Preview */}
        {formData.image_url && !errors.image_url && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
            <div className="relative w-32 h-32 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <img
                src={formData.image_url}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  setErrors(prev => ({ ...prev, image_url: 'Failed to load image' }));
                }}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <Button
            type="submit"
            disabled={!isFormValid() || loading}
            className="flex items-center gap-2 min-w-[140px] justify-center"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                Submitting...
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