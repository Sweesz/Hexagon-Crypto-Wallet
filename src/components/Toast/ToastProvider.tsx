import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ToastContext,
  type ToastItem,
  type ShowToastOptions,
  type ToastContextValue,
} from './ToastContext';
import { ToastItemView } from './ToastItemView';
import { parseAppError } from '../../utils/errorHandler';
import './Toast.css';

export interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    // Clear timer if active
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (options: ShowToastOptions): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const type = options.type || 'info';

      // AC 3: Success toasts auto-dismiss after 4 seconds (4000ms)
      let defaultDuration: number | undefined;
      if (type === 'success') {
        defaultDuration = 4000;
      } else if (type === 'warning') {
        defaultDuration = 5000;
      } else if (type === 'error') {
        defaultDuration = 8000;
      } else {
        defaultDuration = 4000;
      }

      const duration = options.duration !== undefined ? options.duration : defaultDuration;

      const newToast: ToastItem = {
        id,
        type,
        message: options.message,
        title: options.title,
        technicalDetails: options.technicalDetails,
        duration,
        createdAt: Date.now(),
      };

      setToasts((prev) => [...prev, newToast]);

      if (duration && duration > 0) {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismissToast]
  );

  const showSuccess = useCallback(
    (message: string, options?: Partial<ShowToastOptions>): string => {
      return showToast({
        ...options,
        type: 'success',
        message,
        // AC 3: Success toasts auto-dismiss after 4 seconds
        duration: options?.duration ?? 4000,
      });
    },
    [showToast]
  );

  const showError = useCallback(
    (messageOrError: unknown, options?: Partial<ShowToastOptions>): string => {
      if (typeof messageOrError === 'string' && !options?.technicalDetails) {
        return showToast({
          ...options,
          type: 'error',
          message: messageOrError,
        });
      }

      const parsed = parseAppError(messageOrError);
      return showToast({
        ...options,
        type: 'error',
        message: options?.message ?? parsed.userMessage,
        technicalDetails: options?.technicalDetails ?? parsed.technicalDetails,
      });
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, options?: Partial<ShowToastOptions>): string => {
      return showToast({
        ...options,
        type: 'warning',
        message,
      });
    },
    [showToast]
  );

  // Clean up all timers on unmount
  useEffect(() => {
    const activeTimers = timersRef.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  const contextValue: ToastContextValue = {
    toasts,
    showToast,
    showSuccess,
    showError,
    showWarning,
    dismissToast,
    clearAllToasts,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div
        className="toast-container"
        data-testid="toast-container"
        aria-live="polite"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <ToastItemView key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
