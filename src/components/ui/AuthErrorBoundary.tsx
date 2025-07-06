import React, { Component, ErrorInfo, ReactNode } from 'react';
import Button from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

class AuthErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AuthErrorBoundary caught an error:', error, errorInfo);

    // Check if it's an auth-related error
    const isAuthError = 
      error.message?.includes('auth') ||
      error.message?.includes('401') ||
      error.message?.includes('JWT') ||
      error.message?.includes('timeout') ||
      error.stack?.includes('auth');

    if (isAuthError && this.state.retryCount < this.maxRetries) {
      console.log(`Auth error detected, attempting retry ${this.state.retryCount + 1}/${this.maxRetries}`);
      
      this.setState(prevState => ({
        retryCount: prevState.retryCount + 1
      }));

      // Auto-retry after a delay
      this.retryTimeout = setTimeout(() => {
        this.handleRetry();
      }, 2000 * (this.state.retryCount + 1)); // Exponential backoff
    } else {
      this.setState({
        error,
        errorInfo,
      });
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReset = () => {
    // Clear all auth-related storage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (err) {
      console.error('Error clearing storage:', err);
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });

    // Force page reload to reset auth state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isAuthError = 
        this.state.error?.message?.includes('auth') ||
        this.state.error?.message?.includes('401') ||
        this.state.error?.message?.includes('JWT') ||
        this.state.error?.message?.includes('timeout');

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                {isAuthError ? 'Authentication Error' : 'Something went wrong'}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {isAuthError 
                  ? 'There was a problem with authentication. This usually resolves itself automatically.'
                  : 'An unexpected error occurred. Please try refreshing the page.'
                }
              </p>
              
              {this.state.retryCount > 0 && this.state.retryCount < this.maxRetries && (
                <div className="mt-4 p-4 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-700">
                    Retry attempt {this.state.retryCount}/{this.maxRetries}...
                  </p>
                  <div className="mt-2">
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${(this.state.retryCount / this.maxRetries) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <Button
                onClick={this.handleRetry}
                className="w-full"
                disabled={this.state.retryCount >= this.maxRetries}
              >
                Try Again
              </Button>

              {isAuthError && (
                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  className="w-full"
                >
                  Reset Authentication
                </Button>
              )}

              <Button
                onClick={() => window.location.href = '/'}
                variant="ghost"
                className="w-full"
              >
                Go to Home Page
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 p-4 bg-red-50 rounded-md">
                <summary className="text-sm font-medium text-red-800 cursor-pointer">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 text-xs text-red-700 whitespace-pre-wrap overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AuthErrorBoundary;