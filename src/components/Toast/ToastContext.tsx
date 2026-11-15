import React, { createContext, useContext } from 'react';
import { parseAppError } from '../../utils/errorHandler';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: React.ReactNode;
  title?: string;
  technicalDetails?: string;
  duration?: number;
  createdAt: number;
}

export interface ShowToastOptions {
  type?: ToastType;
  message: React.ReactNode;
  title?: string;
  technicalDetails?: string;
  duration?: number;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (options: ShowToastOptions) => string;
  showSuccess: (message: React.ReactNode, options?: Partial<ShowToastOptions>) => string;
  showError: (messageOrError: unknown, options?: Partial<ShowToastOptions>) => string;
  showWarning: (message: React.ReactNode, options?: Partial<ShowToastOptions>) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Hook to access global toast notifications.
 * Provides safe fallback if invoked outside ToastProvider to avoid crashes in isolated tests.
 */
export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback for components tested in isolation
    return {
      toasts: [],
      showToast: () => 'fallback-toast-id',
      showSuccess: () => 'fallback-toast-id',
      showError: () => 'fallback-toast-id',
      showWarning: () => 'fallback-toast-id',
      dismissToast: () => {},
      clearAllToasts: () => {},
    };
  }
  return context;
};
