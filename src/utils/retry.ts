import { isTransientNetworkError } from './errorHandler';
import { logger } from './logger';

export interface RetryOptions {
  /**
   * Maximum number of total attempts (initial attempt + retries).
   * Default: 3.
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds before the first retry.
   * Default: 400ms (or 0ms in test environments).
   */
  initialDelayMs?: number;

  /**
   * Backoff multiplier applied after each failed attempt.
   * Default: 2.
   */
  backoffFactor?: number;

  /**
   * Optional custom predicate to determine if an error is transient.
   * Defaults to `isTransientNetworkError`.
   */
  isTransient?: (error: unknown) => boolean;

  /**
   * Optional callback triggered on each retry attempt.
   */
  onRetry?: (attempt: number, error: unknown, nextDelayMs: number) => void;
}

const isTestEnv = (): boolean => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'test';
  }
  return false;
};

/**
 * Executes an asynchronous task with automatic retry for transient network errors.
 * Re-throws immediately for non-transient errors (e.g. invalid arguments, contract logic).
 *
 * @param fn Asynchronous function to execute
 * @param options Retry options
 * @returns Result of the successful execution
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const initialDelay = options.initialDelayMs ?? (isTestEnv() ? 0 : 400);
  const backoffFactor = options.backoffFactor ?? 2;
  const isTransient = options.isTransient ?? isTransientNetworkError;

  let lastError: unknown;
  let currentDelay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Do not retry if this was the last attempt
      if (attempt >= maxAttempts) {
        break;
      }

      // Do not retry non-transient errors (e.g., validation or contract errors)
      if (!isTransient(err)) {
        logger.debug(`Non-transient error on attempt ${attempt}, skipping retries:`, err);
        throw err;
      }

      logger.warn(`Transient error on attempt ${attempt}/${maxAttempts}. Retrying in ${currentDelay}ms...`, err);
      options.onRetry?.(attempt, err, currentDelay);

      if (currentDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
      }

      currentDelay *= backoffFactor;
    }
  }

  throw lastError;
}
