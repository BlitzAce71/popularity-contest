import React, { Component, ErrorInfo, ReactNode } from 'react';
import Button from './Button';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId: string;
  retryCount: number;
}

/**
 * Enhanced error boundary with automatic recovery and circuit breaker pattern
 * Prevents cascading failures from making the entire site unusable
 */
class ErrorRecovery extends Component<Props, State> {
  private maxRetries = 3;
  private retryDelay = 1000;

  public state: State = {
    hasError: false,
    errorId: '',
    retryCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return { 
      hasError: true, 
      error,
      errorId,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`🚨 ErrorRecovery caught error [${this.state.errorId}]:`, error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Attempt automatic recovery for certain types of errors
    if (this.shouldAutoRecover(error) && this.state.retryCount < this.maxRetries) {
      console.log(`🔄 Attempting auto-recovery (attempt ${this.state.retryCount + 1}/${this.maxRetries})`);
      setTimeout(() => {
        this.handleRetry();
      }, this.retryDelay * (this.state.retryCount + 1)); // Exponential backoff
    }
  }

  private shouldAutoRecover = (error: Error): boolean => {
    // Auto-recover from network errors, timeout errors, etc.
    const recoverableErrors = [
      'Failed to fetch',
      'Network request failed',
      'timeout',
      'Connection refused',
      'CORS',
    ];

    return recoverableErrors.some(msg => 
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  };

  private handleRetry = () => {
    console.log(`🔄 Manual retry triggered [${this.state.errorId}]`);
    
    this.setState(prevState => ({
      hasError: false,
      error: undefined,
      retryCount: prevState.retryCount + 1,
    }));
  };

  private handleReset = () => {
    console.log(`🔄 Full reset triggered [${this.state.errorId}]`);
    
    this.setState({
      hasError: false,
      error: undefined,
      errorId: '',
      retryCount: 0,
    });
  };

  private handleReload = () => {
    console.log(`🔄 Page reload triggered [${this.state.errorId}]`);
    window.location.reload();
  };

  public render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default error UI with recovery options
      const isNetworkError = this.shouldAutoRecover(this.state.error);
      const hasRetriesLeft = this.state.retryCount < this.maxRetries;

      return (
        <div className="min-h-64 flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 border border-red-200">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {isNetworkError ? 'Connection Problem' : 'Something went wrong'}
              </h3>
              
              <p className="text-sm text-gray-500 mb-4">
                {isNetworkError 
                  ? 'We\'re having trouble connecting to our servers. This usually resolves itself quickly.'
                  : 'An unexpected error occurred, but don\'t worry - you can try again.'
                }
              </p>

              {this.state.retryCount > 0 && (
                <p className="text-xs text-gray-400 mb-4">
                  Retry attempt: {this.state.retryCount}/{this.maxRetries}
                </p>
              )}

              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-800">
                  Technical details
                </summary>
                <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto max-h-32">
                  {this.state.error.message}
                  {this.state.error.stack && `\n\nStack trace:\n${this.state.error.stack.slice(0, 500)}`}
                </pre>
              </details>
            </div>

            <div className="flex flex-col gap-2">
              {hasRetriesLeft && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={this.handleRetry}
                  className="w-full"
                >
                  Try Again
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="w-full"
              >
                Reset Component
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReload}
                className="w-full text-gray-600"
              >
                Reload Page
              </Button>
            </div>

            <p className="text-xs text-gray-400 text-center mt-4">
              Error ID: {this.state.errorId}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorRecovery;