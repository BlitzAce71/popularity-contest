import { useState, useCallback } from 'react';
import { ToastMessage } from '@/components/ui/Toast';

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((
    message: string,
    type: ToastMessage['type'] = 'info',
    options?: Partial<Omit<ToastMessage, 'id' | 'message' | 'type'>>
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: ToastMessage = {
      id,
      type,
      message,
      duration: 5000, // Default 5 seconds
      ...options,
    };

    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const toast = {
    success: (message: string, options?: Partial<Omit<ToastMessage, 'id' | 'message' | 'type'>>) =>
      addToast(message, 'success', options),
    error: (message: string, options?: Partial<Omit<ToastMessage, 'id' | 'message' | 'type'>>) =>
      addToast(message, 'error', { duration: 7000, ...options }),
    warning: (message: string, options?: Partial<Omit<ToastMessage, 'id' | 'message' | 'type'>>) =>
      addToast(message, 'warning', options),
    info: (message: string, options?: Partial<Omit<ToastMessage, 'id' | 'message' | 'type'>>) =>
      addToast(message, 'info', options),
  };

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    toast,
  };
};