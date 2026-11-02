import { logger } from './logger';

export interface ParsedAppError {
  /**
   * Human-readable, user-friendly message intended for display in UI toasts.
   */
  userMessage: string;

  /**
   * Technical diagnostics for debugging (raw message, stack, status codes).
   */
  technicalDetails?: string;

  /**
   * Whether this error indicates a transient network condition suitable for automatic retry.
   */
  isTransient: boolean;

  /**
   * Original error source.
   */
  originalError: unknown;
}

/**
 * Checks if an error represents a transient network or server condition.
 */
export function isTransientNetworkError(error: unknown): boolean {
  if (!error) return false;

  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const name = error instanceof Error ? error.name.toLowerCase() : '';
  const anyErr = error as any;
  const status = anyErr?.status || anyErr?.statusCode || anyErr?.response?.status;

  // Rate limiting (HTTP 429) or transient server errors (500, 502, 503, 504)
  if (status === 429 || (typeof status === 'number' && status >= 500 && status <= 504)) {
    return true;
  }

  // Common network drop / timeout signatures
  const transientKeywords = [
    'failed to fetch',
    'fetch failed',
    'network error',
    'network failure',
    'enotfound',
    'econnrefused',
    'etimedout',
    'econnreset',
    'enetunreach',
    'timeout',
    'timed out',
    'rate limit',
    '429',
    'abort',
  ];

  return transientKeywords.some((keyword) => msg.includes(keyword) || name.includes(keyword));
}

/**
 * Formats any error into a human-readable user message and technical details.
 */
export function parseAppError(error: unknown, fallbackMessage = 'An unexpected error occurred'): ParsedAppError {
  // Log error using environment-aware logger
  logger.error('parseAppError encountered:', error);

  if (error === null || error === undefined) {
    return {
      userMessage: fallbackMessage,
      isTransient: false,
      originalError: error,
    };
  }

  let rawMessage = '';
  let technicalDetails: string | undefined;

  if (error instanceof Error) {
    rawMessage = error.message || error.name;
    const parts: string[] = [`Error: ${rawMessage}`];
    if (error.stack) {
      parts.push(`Stack: ${error.stack}`);
    }
    const anyErr = error as any;
    if (anyErr.response?.status) {
      parts.push(`HTTP Status: ${anyErr.response.status}`);
    }
    if (anyErr.code) {
      parts.push(`Code: ${anyErr.code}`);
    }
    technicalDetails = parts.join('\n\n');
  } else if (typeof error === 'string') {
    rawMessage = error;
    technicalDetails = `Raw message: ${error}`;
  } else {
    try {
      rawMessage = JSON.stringify(error);
      technicalDetails = `Error details: ${JSON.stringify(error, null, 2)}`;
    } catch {
      rawMessage = String(error);
      technicalDetails = `Raw error: ${String(error)}`;
    }
  }

  const lower = rawMessage.toLowerCase();
  const isTransient = isTransientNetworkError(error);

  let userMessage = fallbackMessage;

  // Categorize error into human-readable message
  if (lower.includes('rate limit') || lower.includes('429') || lower.includes('too many requests')) {
    userMessage = 'Network rate limit exceeded. Please wait a few seconds and try again.';
  } else if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('etimedout')) {
    userMessage = 'Request timed out after waiting for network response. Please try again.';
  } else if (
    lower.includes('failed to fetch') ||
    lower.includes('fetch failed') ||
    lower.includes('network error') ||
    lower.includes('network failure') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset')
  ) {
    userMessage = 'Unable to connect to the TON network. Please verify your internet connection.';
  } else if (
    lower.includes('insufficient funds') ||
    lower.includes('exit_code: 37') ||
    lower.includes('not enough balance') ||
    lower.includes('not enough funds') ||
    lower.includes('cannot pay')
  ) {
    userMessage = 'Insufficient funds to complete this transaction and cover network fees.';
  } else if (
    lower.includes('bad seqno') ||
    lower.includes('invalid seqno') ||
    lower.includes('exit_code: 33') ||
    lower.includes('sequence number')
  ) {
    userMessage = 'Transaction sequence mismatch. Please refresh and try again.';
  } else if (
    lower.includes('contract not deployed') ||
    lower.includes('uninitialized') ||
    lower.includes('not deployed')
  ) {
    userMessage = 'Sender wallet is not deployed or initialized on the blockchain.';
  } else if (lower.includes('invalid ton address') || lower.includes('invalid address')) {
    userMessage = 'Invalid TON address format. Please check and re-enter the address.';
  } else if (lower.includes('invalid amount')) {
    userMessage = 'Invalid amount. Please specify a valid amount greater than 0.';
  } else if (lower.includes('clipboard')) {
    userMessage = 'Could not copy to clipboard. Please copy the text manually.';
  } else if (rawMessage && !rawMessage.startsWith('{') && rawMessage.length < 150) {
    // If the message is already short and human-readable (not JSON), use it
    userMessage = rawMessage;
  }

  return {
    userMessage,
    technicalDetails,
    isTransient,
    originalError: error,
  };
}
