import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../src/utils/retry';
import { parseAppError, isTransientNetworkError } from '../src/utils/errorHandler';
import { executeAsyncWithFeedback } from '../src/utils/asyncHandler';

describe('Retry & Error Handling utilities (Tasks 2, 4, 5 & AC 2, 4)', () => {
  describe('withRetry (Task 4: Retry mechanism for transient network errors, max 3 attempts)', () => {
    it('succeeds on first attempt without retrying', async () => {
      const fn = vi.fn().mockResolvedValue('success-result');

      const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 1 });
      expect(result).toBe('success-result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries up to 3 times on transient network error and succeeds on 3rd attempt', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND'))
        .mockResolvedValueOnce('recovered-data');

      const retrySpy = vi.fn();
      const result = await withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 1,
        backoffFactor: 1,
        onRetry: retrySpy,
      });

      expect(result).toBe('recovered-data');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(retrySpy).toHaveBeenCalledTimes(2);
    });

    it('fails after 3 attempts if transient error persists', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('ETIMEDOUT connection timed out'));

      await expect(
        withRetry(fn, { maxAttempts: 3, initialDelayMs: 1, backoffFactor: 1 })
      ).rejects.toThrow(/ETIMEDOUT/);

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('immediately throws non-transient error without retrying', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Invalid TON address: malformed raw string'));

      await expect(
        withRetry(fn, { maxAttempts: 3, initialDelayMs: 1 })
      ).rejects.toThrow(/Invalid TON address/);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('errorHandler & parseAppError (Task 5 & AC 2)', () => {
    it('correctly detects transient errors', () => {
      expect(isTransientNetworkError(new Error('fetch failed'))).toBe(true);
      expect(isTransientNetworkError(new Error('Network failure'))).toBe(true);
      expect(isTransientNetworkError(new Error('ECONNRESET'))).toBe(true);
      expect(isTransientNetworkError(new Error('Rate limit exceeded'))).toBe(true);
      expect(isTransientNetworkError({ response: { status: 429 } })).toBe(true);

      // Non-transient
      expect(isTransientNetworkError(new Error('Invalid TON address'))).toBe(false);
      expect(isTransientNetworkError(new Error('Insufficient funds'))).toBe(false);
    });

    it('maps network errors to human-readable message and provides technical details', () => {
      const err = new Error('getaddrinfo ENOTFOUND testnet.toncenter.com');
      const parsed = parseAppError(err);

      expect(parsed.userMessage).toContain('Unable to connect to the TON network');
      expect(parsed.technicalDetails).toContain('ENOTFOUND');
      expect(parsed.isTransient).toBe(true);
    });

    it('maps insufficient funds errors to friendly message', () => {
      const err = new Error('LiteServer response error: exit_code: 37');
      const parsed = parseAppError(err);

      expect(parsed.userMessage).toContain('Insufficient funds');
      expect(parsed.technicalDetails).toContain('exit_code: 37');
    });

    it('maps rate limit 429 to friendly message', () => {
      const err = new Error('Request failed with status code 429: too many requests');
      const parsed = parseAppError(err);

      expect(parsed.userMessage).toContain('rate limit');
    });
  });

  describe('executeAsyncWithFeedback (Task 2 & AC 4: No unhandled rejections)', () => {
    it('manages loading state and returns result on success', async () => {
      const setLoadingMock = vi.fn();
      const toastMock = {
        toasts: [],
        showToast: vi.fn(),
        showSuccess: vi.fn(),
        showError: vi.fn(),
        showWarning: vi.fn(),
        dismissToast: vi.fn(),
        clearAllToasts: vi.fn(),
      };

      const result = await executeAsyncWithFeedback(
        async () => 'wallet-balance-42',
        {
          setIsLoading: setLoadingMock,
          toast: toastMock,
          successMessage: 'Loaded successfully',
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('wallet-balance-42');
      expect(setLoadingMock).toHaveBeenCalledWith(true);
      expect(setLoadingMock).toHaveBeenCalledWith(false);
      expect(toastMock.showSuccess).toHaveBeenCalledWith('Loaded successfully');
    });

    it('gracefully handles error without throwing unhandled promise rejection', async () => {
      const toastMock = {
        toasts: [],
        showToast: vi.fn(),
        showSuccess: vi.fn(),
        showError: vi.fn(),
        showWarning: vi.fn(),
        dismissToast: vi.fn(),
        clearAllToasts: vi.fn(),
      };

      const result = await executeAsyncWithFeedback(
        async () => {
          throw new Error('Connection refused ECONNREFUSED');
        },
        {
          toast: toastMock,
          retryTransient: false,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(toastMock.showError).toHaveBeenCalled();
    });
  });
});
