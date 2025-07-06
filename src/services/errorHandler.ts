// Global error handling service
export class ErrorHandlerService {
  private static toastFunction: ((message: string, type: 'error' | 'warning' | 'info') => void) | null = null;

  // Set the toast function from the ToastContext
  static setToastFunction(toastFn: (message: string, type: 'error' | 'warning' | 'info') => void) {
    this.toastFunction = toastFn;
  }

  // Handle and categorize errors
  static handleError(error: unknown, context?: string): string {
    const errorMessage = this.parseError(error);
    const categorizedError = this.categorizeError(errorMessage, context);
    
    // Log to console for debugging
    console.error(`[${context || 'Unknown'}] Error:`, error);
    
    // Show toast notification if available
    if (this.toastFunction) {
      this.toastFunction(categorizedError.userMessage, categorizedError.type);
    }
    
    return categorizedError.userMessage;
  }

  // Parse error into readable message
  private static parseError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as any).message);
    }
    
    return 'An unexpected error occurred';
  }

  // Categorize errors for better user experience
  private static categorizeError(message: string, context?: string): {
    userMessage: string;
    type: 'error' | 'warning' | 'info';
  } {
    const lowerMessage = message.toLowerCase();
    
    // Network errors
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return {
        userMessage: 'Network error. Please check your connection and try again.',
        type: 'error'
      };
    }
    
    // Authentication errors
    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication')) {
      return {
        userMessage: 'Your session has expired. Please sign in again.',
        type: 'warning'
      };
    }
    
    // Permission errors
    if (lowerMessage.includes('forbidden') || lowerMessage.includes('permission')) {
      return {
        userMessage: 'You don\'t have permission to perform this action.',
        type: 'warning'
      };
    }
    
    // Validation errors
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      return {
        userMessage: message, // Show validation errors as-is
        type: 'warning'
      };
    }
    
    // Tournament specific errors
    if (context === 'tournament') {
      if (lowerMessage.includes('not found')) {
        return {
          userMessage: 'Tournament not found or has been removed.',
          type: 'error'
        };
      }
      if (lowerMessage.includes('registration')) {
        return {
          userMessage: 'Registration for this tournament is not available.',
          type: 'warning'
        };
      }
    }
    
    // Voting specific errors
    if (context === 'voting') {
      if (lowerMessage.includes('already voted')) {
        return {
          userMessage: 'You have already voted in this matchup.',
          type: 'info'
        };
      }
      if (lowerMessage.includes('voting closed')) {
        return {
          userMessage: 'Voting for this matchup has ended.',
          type: 'info'
        };
      }
    }
    
    // Default error
    return {
      userMessage: message || 'Something went wrong. Please try again.',
      type: 'error'
    };
  }

  // Handle async operation errors with retry logic
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context?: string,
    retries: number = 0
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0 && this.shouldRetry(error)) {
        console.warn(`Retrying operation (${retries} attempts left)`);
        await this.delay(1000); // Wait 1 second before retry
        return this.withErrorHandling(operation, context, retries - 1);
      }
      
      this.handleError(error, context);
      return null;
    }
  }

  // Determine if an error should trigger a retry
  private static shouldRetry(error: unknown): boolean {
    const message = this.parseError(error).toLowerCase();
    
    // Retry on network errors
    if (message.includes('network') || message.includes('fetch')) {
      return true;
    }
    
    // Retry on temporary server errors
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return true;
    }
    
    return false;
  }

  // Utility function for delays
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Handle form validation errors
  static handleFormErrors(errors: Record<string, any>): Record<string, string> {
    const formattedErrors: Record<string, string> = {};
    
    Object.entries(errors).forEach(([field, error]) => {
      if (error && typeof error === 'object' && 'message' in error) {
        formattedErrors[field] = error.message;
      } else if (typeof error === 'string') {
        formattedErrors[field] = error;
      } else {
        formattedErrors[field] = 'Invalid value';
      }
    });
    
    return formattedErrors;
  }

  // Handle API response errors
  static handleApiError(response: { status?: number; data?: { message?: string }; message?: string }): never {
    const status = response?.status || 0;
    const message = response?.data?.message || response?.message || 'API request failed';
    
    switch (status) {
      case 400:
        throw new Error(`Bad Request: ${message}`);
      case 401:
        throw new Error('Authentication required. Please sign in.');
      case 403:
        throw new Error('You don\'t have permission to access this resource.');
      case 404:
        throw new Error('The requested resource was not found.');
      case 409:
        throw new Error(`Conflict: ${message}`);
      case 422:
        throw new Error(`Validation Error: ${message}`);
      case 429:
        throw new Error('Too many requests. Please try again later.');
      case 500:
        throw new Error('Server error. Please try again later.');
      case 502:
      case 503:
      case 504:
        throw new Error('Service temporarily unavailable. Please try again later.');
      default:
        throw new Error(message);
    }
  }
}