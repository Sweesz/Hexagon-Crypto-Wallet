/**
 * Logger utility with environment-aware output.
 * Logs full diagnostic information in development/test mode,
 * and suppresses technical details or stack traces in production mode.
 */

const isDev = (): boolean => {
  // Vite exposes import.meta.env.DEV
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return Boolean(import.meta.env.DEV);
  }
  // Fallback for Node/test environments
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV !== 'production';
  }
  return false;
};

export interface Logger {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

export const logger: Logger = {
  log: (...args: unknown[]) => {
    if (isDev()) {
      console.log('[Hexagon Wallet]', ...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDev()) {
      console.info('[Hexagon Wallet:INFO]', ...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev()) {
      console.warn('[Hexagon Wallet:WARN]', ...args);
    }
  },
  error: (...args: unknown[]) => {
    if (isDev()) {
      console.error('[Hexagon Wallet:ERROR]', ...args);
    } else {
      // In production mode, log sanitized message without leaking raw stack/technical details
      const sanitized = args.map((arg) => {
        if (arg instanceof Error) {
          return arg.message || 'An error occurred';
        }
        if (typeof arg === 'object' && arg !== null) {
          return '[Object error details hidden in production]';
        }
        return arg;
      });
      console.error('[Hexagon Wallet]', ...sanitized);
    }
  },
  debug: (...args: unknown[]) => {
    if (isDev()) {
      console.debug('[Hexagon Wallet:DEBUG]', ...args);
    }
  },
};

export default logger;
