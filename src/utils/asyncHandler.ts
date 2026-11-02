import { withRetry } from './retry';
import { parseAppError, type ParsedAppError } from './errorHandler';
import { logger } from './logger';
import type { ToastContextValue } from '../components/Toast/ToastContext';

export interface ExecuteAsyncOptions<T> {
  /**
   * Optional loading state updater.
   */
  setIsLoading?: (loading: boolean) => void;

  /**
   * Toast context instance.
   */
  toast?: ToastContextValue;

  /**
   * Message or resolver to display in success toast.
   */
  successMessage?: string | ((result: T) => string);

  /**
   * Custom user-friendly fallback error message.
   */
  errorMessage?: string;

  /**
   * Whether to display a toast on success (default: true if successMessage is set).
   */
  showSuccessToast?: boolean;

  /**
   * Whether to display a toast on error (default: true).
   */
  showErrorToast?: boolean;

  /**
   * Whether to automatically retry transient network errors.
   * Default: true.
   */
  retryTransient?: boolean;

  /**
   * Maximum retry attempts for transient errors.
   * Default: 3.
   */
  maxRetries?: number;

  /**
   * Success callback.
   */
  onSuccess?: (result: T) => void;

  /**
   * Error callback.
   */
  onError?: (error: unknown, parsed: ParsedAppError) => void;
}

export interface AsyncExecutionResult<T> {
  success: boolean;
  data?: T;
  error?: unknown;
  parsedError?: ParsedAppError;
}

/**
 * Standardized wrapper for executing asynchronous operations with loading state,
 * automatic retries for transient errors, error parsing, logging, and toast feedback.
 *
 * Guarantees that no unhandled promise rejections escape into the environment.
 */
export async function executeAsyncWithFeedback<T>(
  action: () => Promise<T>,
  options: ExecuteAsyncOptions<T> = {}
): Promise<AsyncExecutionResult<T>> {
  const {
    setIsLoading,
    toast,
    successMessage,
    errorMessage,
    showSuccessToast = Boolean(successMessage),
    showErrorToast = true,
    retryTransient = true,
    maxRetries = 3,
    onSuccess,
    onError,
  } = options;

  setIsLoading?.(true);

  try {
    const wrappedAction = retryTransient
      ? () => withRetry(action, { maxAttempts: maxRetries })
      : action;

    const data = await wrappedAction();

    if (showSuccessToast && toast) {
      const msg = typeof successMessage === 'function' ? successMessage(data) : successMessage;
      if (msg) {
        toast.showSuccess(msg);
      }
    }

    onSuccess?.(data);

    return {
      success: true,
      data,
    };
  } catch (err: unknown) {
    const parsed = parseAppError(err, errorMessage);
    logger.error('executeAsyncWithFeedback caught error:', err);

    if (showErrorToast && toast) {
      toast.showError(err, {
        message: errorMessage ?? parsed.userMessage,
        technicalDetails: parsed.technicalDetails,
      });
    }

    onError?.(err, parsed);

    return {
      success: false,
      error: err,
      parsedError: parsed,
    };
  } finally {
    setIsLoading?.(false);
  }
}
