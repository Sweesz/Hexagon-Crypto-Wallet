import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Address, fromNano } from '@ton/core';
import { getBalance } from '../wallet/getBalance';
import './CheckBalance.css';

/**
 * Validates whether the given string is a valid TON address.
 * Uses Address.parse from @ton/core to verify friendly/raw format and checksum.
 */
export const isValidTonAddress = (address: string): boolean => {
  const trimmed = address.trim();
  if (!trimmed) return false;
  try {
    Address.parse(trimmed);
    return true;
  } catch {
    return false;
  }
};

/**
 * Formats a bigint nano-tons amount into human-readable TON string.
 * Divides by 1e9 using fromNano and appends ' TON'.
 */
export const formatTonBalance = (nanoTons: bigint): string => {
  if (nanoTons === 0n) {
    return '0 TON';
  }
  return `${fromNano(nanoTons)} TON`;
};

export const CheckBalance: React.FC = () => {
  const [address, setAddress] = useState<string>('');
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isTimeout, setIsTimeout] = useState<boolean>(false);

  const requestIdRef = useRef<number>(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clears any active timeout timer
  const clearTimeoutTimer = () => {
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  };

  // Clears any pending debounce timer
  const clearDebounceTimer = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  /**
   * Fetches balance from TON network with a 10-second timeout guard.
   */
  const fetchBalance = useCallback(async (targetAddress: string, isAutoRefresh = false) => {
    const trimmed = targetAddress.trim();

    // Input validation prevents API calls for malformed strings
    if (!isValidTonAddress(trimmed)) {
      if (trimmed.length > 0) {
        setError('Invalid TON address format');
      } else {
        setError(null);
      }
      setBalance(null);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    clearTimeoutTimer();

    setIsLoading(true);
    if (!isAutoRefresh) {
      setError(null);
      setIsTimeout(false);
    }

    // Network timeout shows retry option after 10 seconds (AC 3)
    timeoutTimerRef.current = setTimeout(() => {
      if (requestIdRef.current === currentRequestId) {
        setIsLoading(false);
        setIsTimeout(true);
        setError('Request timed out after 10 seconds. Network failure.');
      }
    }, 10000);

    try {
      const nanoBalance = await getBalance(trimmed);

      // Check if this is still the active request
      if (requestIdRef.current === currentRequestId) {
        clearTimeoutTimer();
        setBalance(formatTonBalance(nanoBalance));
        setError(null);
        setIsTimeout(false);
        setIsLoading(false);
      }
    } catch (err: unknown) {
      if (requestIdRef.current === currentRequestId) {
        clearTimeoutTimer();
        setIsLoading(false);
        setIsTimeout(true);

        const rawMessage = err instanceof Error ? err.message : String(err);
        if (rawMessage.toLowerCase().includes('failed to fetch') || rawMessage.toLowerCase().includes('network')) {
          setError('Network failure: unable to connect to TON network.');
        } else {
          setError(rawMessage);
        }
      }
    }
  }, []);

  /**
   * Real-time balance fetching on address input change
   */
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddress(val);
    clearDebounceTimer();

    const trimmed = val.trim();
    if (!trimmed) {
      setError(null);
      setBalance(null);
      setIsTimeout(false);
      return;
    }

    if (!isValidTonAddress(trimmed)) {
      setError('Invalid TON address format');
      setBalance(null);
      setIsTimeout(false);
      return;
    }

    // Clear previous error when address becomes valid
    setError(null);
    setIsTimeout(false);

    // Debounce real-time fetch to avoid flooding
    debounceTimerRef.current = setTimeout(() => {
      fetchBalance(trimmed);
    }, 350);
  };

  /**
   * Manual balance check trigger
   */
  const handleCheckBalance = () => {
    clearDebounceTimer();
    const trimmed = address.trim();

    if (!trimmed) {
      setError('Please enter a TON address');
      setBalance(null);
      return;
    }

    if (!isValidTonAddress(trimmed)) {
      setError('Invalid TON address format');
      setBalance(null);
      return;
    }

    fetchBalance(trimmed);
  };

  /**
   * Retry handler for network failure or timeout
   */
  const handleRetry = () => {
    clearDebounceTimer();
    const trimmed = address.trim();
    if (isValidTonAddress(trimmed)) {
      fetchBalance(trimmed);
    }
  };

  /**
   * Auto-refresh balance every 30 seconds when wallet is active (Task 6)
   */
  useEffect(() => {
    const trimmed = address.trim();
    if (!isValidTonAddress(trimmed)) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchBalance(trimmed, true);
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [address, fetchBalance]);

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      clearDebounceTimer();
      clearTimeoutTimer();
    };
  }, []);

  return (
    <div className="wallet-container">
      <div className="wallet-card">
        <h2 className="wallet-title">Check Balance</h2>

        <div className="wallet-section">
          <label htmlFor="ton-address" className="wallet-label">
            TON Address:
          </label>
          <input
            id="ton-address"
            type="text"
            className={`wallet-input ${error && !isLoading ? 'input-error' : ''}`}
            placeholder="Enter TON address"
            value={address}
            onChange={handleAddressChange}
            disabled={isLoading}
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        <div className="wallet-section">
          <button
            type="button"
            className="btn-primary"
            onClick={handleCheckBalance}
            disabled={isLoading}
          >
            {isLoading ? 'Checking...' : 'Check Balance'}
          </button>
        </div>

        {/* Loading Spinner during API call (Task 4) */}
        {isLoading && (
          <div className="balance-loading-container" data-testid="loading-spinner">
            <span className="spinner" />
            <span>Loading balance...</span>
          </div>
        )}

        {/* User-friendly error message & Retry button (Task 5 & AC 3) */}
        {error && !isLoading && (
          <div className="wallet-section balance-error" data-testid="error-message">
            <span className="balance-error-message">{error}</span>
            {isTimeout && (
              <button
                type="button"
                className="btn-retry"
                data-testid="retry-button"
                onClick={handleRetry}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Balance Display (AC 1 & AC 2) */}
        {balance !== null && !isLoading && !error && (
          <>
            <div className="wallet-section balance-result" data-testid="balance-display">
              <span className="balance-label">Balance:</span>
              <span className="balance-value">{balance}</span>
            </div>
            <div className="balance-auto-refresh">
              <span className="refresh-dot" />
              <span>Auto-refreshes every 30s</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CheckBalance;
