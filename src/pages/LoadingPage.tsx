import React from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Trophy } from 'lucide-react';

interface LoadingPageProps {
  message?: string;
  showLogo?: boolean;
}

const LoadingPage: React.FC<LoadingPageProps> = ({ 
  message = 'Loading...', 
  showLogo = true 
}) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center space-y-6">
        {showLogo && (
          <div className="flex items-center justify-center space-x-2">
            <Trophy className="h-8 w-8 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">
              Popularity Contest
            </span>
          </div>
        )}
        
        <div className="space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600 font-medium">{message}</p>
        </div>
        
        <div className="text-xs text-gray-400">
          <p>This shouldn't take long...</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingPage;