import React, { createContext, useContext } from 'react';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';

type ToastContextType = ReturnType<typeof useToast>;

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const toastHook = useToast();

  return (
    <ToastContext.Provider value={toastHook}>
      {children}
      <ToastContainer toasts={toastHook.toasts} onDismiss={toastHook.removeToast} />
    </ToastContext.Provider>
  );
};