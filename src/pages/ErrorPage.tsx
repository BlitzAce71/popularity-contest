import React from 'react';
import { useRouteError, Link } from 'react-router-dom';
import Button from '@/components/ui/Button';
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';

interface RouteError {
  statusText?: string;
  message?: string;
  status?: number;
}

const ErrorPage: React.FC = () => {
  const error = useRouteError() as RouteError;
  
  const getErrorMessage = () => {
    if (error?.status === 404) {
      return {
        title: 'Page Not Found',
        description: "The page you're looking for doesn't exist or has been moved.",
        suggestion: 'Check the URL or navigate back to the homepage.'
      };
    }
    
    if (error?.status === 403) {
      return {
        title: 'Access Denied',
        description: "You don't have permission to access this page.",
        suggestion: 'Sign in with appropriate credentials or contact an administrator.'
      };
    }
    
    if (error?.status === 500) {
      return {
        title: 'Server Error',
        description: 'Something went wrong on our end.',
        suggestion: 'Please try again later or contact support if the problem persists.'
      };
    }
    
    return {
      title: 'Oops! Something went wrong',
      description: error?.statusText || error?.message || 'An unexpected error occurred.',
      suggestion: 'Please try refreshing the page or go back to the homepage.'
    };
  };

  const errorInfo = getErrorMessage();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100">
            <AlertTriangle className="h-10 w-10 text-red-600" />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-gray-900">
            {errorInfo.title}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {errorInfo.description}
          </p>
          <p className="mt-4 text-sm text-gray-500">
            {errorInfo.suggestion}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button 
            onClick={() => window.history.back()}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
          
          <Link to="/">
            <Button className="flex items-center gap-2 w-full sm:w-auto">
              <Home className="w-4 h-4" />
              Homepage
            </Button>
          </Link>
        </div>

        <div className="mt-8 text-xs text-gray-400">
          {error?.status && (
            <p>Error Code: {error.status}</p>
          )}
          <p className="mt-1">
            If this problem persists, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;