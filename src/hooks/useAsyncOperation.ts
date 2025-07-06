import { useState, useCallback } from 'react';

interface AsyncOperationState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface AsyncOperationActions<T> {
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
  setData: (data: T | null) => void;
  setError: (error: string | null) => void;
}

export function useAsyncOperation<T>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options?: {
    initialData?: T | null;
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
  }
): AsyncOperationState<T> & AsyncOperationActions<T> {
  const [state, setState] = useState<AsyncOperationState<T>>({
    data: options?.initialData || null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        
        const result = await asyncFunction(...args);
        
        setState(prev => ({ ...prev, data: result, loading: false }));
        options?.onSuccess?.(result);
        
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        setState(prev => ({ ...prev, error: errorMessage, loading: false }));
        options?.onError?.(errorMessage);
        
        return null;
      }
    },
    [asyncFunction, options]
  );

  const reset = useCallback(() => {
    setState({
      data: options?.initialData || null,
      loading: false,
      error: null,
    });
  }, [options?.initialData]);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  return {
    ...state,
    execute,
    reset,
    setData,
    setError,
  };
}

// Helper hook for handling multiple async operations
export function useAsyncOperations() {
  const [globalLoading, setGlobalLoading] = useState(false);
  const [operations, setOperations] = useState<Map<string, boolean>>(new Map());

  const startOperation = useCallback((key: string) => {
    setOperations(prev => new Map(prev).set(key, true));
    setGlobalLoading(true);
  }, []);

  const endOperation = useCallback((key: string) => {
    setOperations(prev => {
      const newMap = new Map(prev);
      newMap.delete(key);
      setGlobalLoading(newMap.size > 0);
      return newMap;
    });
  }, []);

  const isOperationActive = useCallback((key: string) => {
    return operations.get(key) || false;
  }, [operations]);

  return {
    globalLoading,
    startOperation,
    endOperation,
    isOperationActive,
    hasActiveOperations: operations.size > 0,
  };
}

// Hook for retry logic with exponential backoff
export function useRetryOperation<T>(
  asyncFunction: (...args: any[]) => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
) {
  const [retryCount, setRetryCount] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const executeWithRetry = useCallback(
    async (...args: any[]): Promise<T> => {
      let lastError: Error;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            setRetrying(true);
            setRetryCount(attempt);
            const delay = initialDelay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          const result = await asyncFunction(...args);
          setRetrying(false);
          setRetryCount(0);
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          
          if (attempt === maxRetries) {
            setRetrying(false);
            setRetryCount(0);
            throw lastError;
          }
        }
      }
      
      throw lastError!;
    },
    [asyncFunction, maxRetries, initialDelay]
  );

  return {
    executeWithRetry,
    retryCount,
    retrying,
  };
}