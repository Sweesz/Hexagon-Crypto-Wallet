import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Address, fromNano } from '@ton/core';
import { getBalance } from '../wallet/getBalance';
import { useToast } from './Toast/ToastContext';
import { BalanceSkeleton } from './Skeleton/Skeleton';
import { Button } from './Button/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card/Card';
import { parseAppError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import './CheckBalance.css';

/* Minimalist bespoke inline SVGs — zero emoji rule */
const ExternalLinkIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={className}
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const EmptyVaultIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={className}
    width="42"
    height="42"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 9v1" />
  </svg>
);

const AlertTriangleIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={className}
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CoinsIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={className}
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="8" cy="8" r="6" />
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
    <path d="M7 6h1v4" />
    <path d="m16.71 13.88.7.71-2.82 2.82" />
  </svg>
);

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
 * Divides by 1e9 using fromNano, adds comma separators to thousands,
 * and appends ' TON'. Handles edge cases safely without floating-point overflow.
 *
 * Examples:
 *  - 0n -> "0 TON"
 *  - 1234560000000n -> "1,234.56 TON"
 *  - 1234000000n -> "1.234 TON"
 *  - 10000000000n -> "10 TON"
 *  - 1n -> "0.000000001 TON"
 */
export const formatTonBalance = (nanoTons: bigint): string => {
  if (nanoTons === 0n) {
    return '0 TON';
  }
  const tonStr = fromNano(nanoTons);
  const [intPart, decPart] = tonStr.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart ? `${formattedInt}.${decPart} TON` : `${formattedInt} TON`;
};

export const CheckBalance: React.FC = () => {
  const [address, setAddress] = useState<string>('');
  const [balance, setBalance] = useState<string | null>(null);
  const [rawNanoBalance, setRawNanoBalance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isUpdated, setIsUpdated] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [technicalDetails, setTechnicalDetails] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [isTimeout, setIsTimeout] = useState<boolean>(false);

  const toast = useToast();

  const requestIdRef = useRef<number>(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const fetchBalance = useCallback(
    async (targetAddress: string, isAutoRefresh = false) => {
      const trimmed = targetAddress.trim();

      // Input validation prevents API calls for malformed strings
      if (!isValidTonAddress(trimmed)) {
        if (trimmed.length > 0) {
          setError('Invalid TON address format');
        } else {
          setError(null);
        }
        setBalance(null);
        setRawNanoBalance(null);
        setTechnicalDetails(null);
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      clearTimeoutTimer();

      if (!isAutoRefresh) {
        setIsLoading(true);
        setError(null);
        setTechnicalDetails(null);
        setShowTechnicalDetails(false);
        setIsTimeout(false);
      } else {
        setIsRefreshing(true);
      }

      // Network timeout shows retry option after 10 seconds (AC 3)
      timeoutTimerRef.current = setTimeout(() => {
        if (requestIdRef.current === currentRequestId) {
          setIsLoading(false);
          setIsRefreshing(false);
          setIsTimeout(true);
          const timeoutMsg = 'Request timed out after 10 seconds. Network failure.';
          setError(timeoutMsg);
          setTechnicalDetails('TimeoutError: The request to TON RPC exceeded 10000ms threshold.');
          toast.showError(timeoutMsg, {
            message: 'Balance check timed out. Please verify connection and retry.',
            technicalDetails: 'Request timed out after 10 seconds. Network failure.',
          });
        }
      }, 10000);

      try {
        const nanoBalance = await getBalance(trimmed);

        // Check if this is still the active request
        if (requestIdRef.current === currentRequestId) {
          clearTimeoutTimer();
          setRawNanoBalance(nanoBalance);
          setBalance(formatTonBalance(nanoBalance));
          setError(null);
          setTechnicalDetails(null);
          setIsTimeout(false);
          setIsLoading(false);
          setIsRefreshing(false);

          // Trigger subtle visual pulse animation on balance update (Task 5)
          setIsUpdated(true);
          if (updateAnimTimeoutRef.current) {
            clearTimeout(updateAnimTimeoutRef.current);
          }
          updateAnimTimeoutRef.current = setTimeout(() => {
            setIsUpdated(false);
          }, 1200);
        }
      } catch (err: unknown) {
        if (requestIdRef.current === currentRequestId) {
          clearTimeoutTimer();
          setIsLoading(false);
          setIsRefreshing(false);
          setIsTimeout(true);

          const parsed = parseAppError(err);
          setTechnicalDetails(parsed.technicalDetails || null);

          const rawMessage = err instanceof Error ? err.message : String(err);
          let displayError = rawMessage;
          if (
            rawMessage.toLowerCase().includes('failed to fetch') ||
            rawMessage.toLowerCase().includes('network')
          ) {
            displayError = 'Network failure: unable to connect to TON network.';
          }
          setError(displayError);

          // Show toast with human-readable error and optional technical details toggle
          toast.showError(err, {
            message: displayError,
            technicalDetails: parsed.technicalDetails,
          });
          logger.error('Failed to fetch balance for address:', trimmed, err);
        }
      }
    },
    [toast]
  );

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
      setRawNanoBalance(null);
      setIsTimeout(false);
      return;
    }

    if (!isValidTonAddress(trimmed)) {
      setError('Invalid TON address format');
      setBalance(null);
      setRawNanoBalance(null);
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
      setRawNanoBalance(null);
      return;
    }

    if (!isValidTonAddress(trimmed)) {
      setError('Invalid TON address format');
      setBalance(null);
      setRawNanoBalance(null);
      return;
    }

    fetchBalance(trimmed);
  };

  /**
   * Retry handler for network failure or timeout without page reload
   */
  const handleRetry = () => {
    clearDebounceTimer();
    const trimmed = address.trim();
    if (isValidTonAddress(trimmed)) {
      fetchBalance(trimmed);
    }
  };

  /**
   * Auto-refresh balance every 30 seconds when address is valid (Task 5 & 6)
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
      if (updateAnimTimeoutRef.current) {
        clearTimeout(updateAnimTimeoutRef.current);
      }
    };
  }, []);

  const isZeroBalance = rawNanoBalance === 0n || balance === '0 TON';

  return (
    <div className="wallet-container">
      {/* Editorial Brutalist Tape / Ribbon Banner with Marquee */}
      <div className="editorial-ribbon" role="banner" aria-label="Статус сети и кошелька">
        <div className="editorial-ribbon-track">
          <span className="editorial-ribbon-segment">
            — БАЛАНС В РЕАЛЬНОМ ВРЕМЕНИ ✦ СЕТЬ TON TESTNET ✦ HEXAGON WALLET ✦ СИНХРОНИЗАЦИЯ 30 СЕКУНД ✦&nbsp;
          </span>
          <span className="editorial-ribbon-segment" aria-hidden="true">
            — БАЛАНС В РЕАЛЬНОМ ВРЕМЕНИ ✦ СЕТЬ TON TESTNET ✦ HEXAGON WALLET ✦ СИНХРОНИЗАЦИЯ 30 СЕКУНД ✦&nbsp;
          </span>
        </div>
      </div>

      <Card variant="paper" padding="lg" className="wallet-card">
        <CardHeader className="wallet-card-header">
          <div className="wallet-badge-row">
            <span className="wallet-badge">LIVE RPC / TESTNET</span>
            <span className="wallet-badge-indicator">
              <span className="status-dot"></span> СЕТЬ АКТИВНА
            </span>
          </div>
          <CardTitle as="h2" className="wallet-title text-display">
            CHECK BALANCE
          </CardTitle>
          <CardDescription className="wallet-description">
            Проверяйте актуальный баланс в сети TON в реальном времени с поддержкой нанотонов и автообновления.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="wallet-section">
            <label htmlFor="ton-address" className="wallet-label">
              TON Address:
            </label>
            <input
              id="ton-address"
              type="text"
              className={`wallet-input text-mono ${error && !isLoading ? 'input-error' : ''}`}
              placeholder="Enter TON address"
              value={address}
              onChange={handleAddressChange}
              disabled={isLoading}
              autoComplete="off"
              spellCheck="false"
            />
          </div>

          <div className="wallet-section">
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleCheckBalance}
              disabled={isLoading}
              isLoading={isLoading}
              className="btn-check-main"
            >
              {isLoading ? 'Checking...' : 'Check Balance'}
            </Button>
          </div>

          {/* Loading Spinner and Skeleton during API call (Task 3 & 4) */}
          {isLoading && (
            <div className="balance-loading-container" data-testid="loading-spinner">
              <span className="spinner" />
              <span>Loading balance...</span>
              <BalanceSkeleton dataTestId="balance-skeleton" />
            </div>
          )}

          {/* User-friendly error message & Retry button & Technical details toggle (Task 6) */}
          {error && !isLoading && (
            <div className="wallet-section balance-error" data-testid="error-message">
              <div className="error-title-row">
                <AlertTriangleIcon className="error-icon" />
                <span className="balance-error-message">{error}</span>
              </div>
              {technicalDetails && (
                <div className="error-details-wrapper">
                  <button
                    type="button"
                    className="btn-details-toggle"
                    data-testid="error-details-toggle"
                    onClick={() => setShowTechnicalDetails((prev) => !prev)}
                  >
                    {showTechnicalDetails ? 'Hide technical details' : 'Show technical details'}
                  </button>
                  {showTechnicalDetails && (
                    <pre className="error-technical-details" data-testid="error-technical-details">
                      {technicalDetails}
                    </pre>
                  )}
                </div>
              )}
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

          {/* Balance Display & Auto-refresh status */}
          {balance !== null && !isLoading && !error && (
            <>
              <div
                className={`wallet-section balance-result ${
                  isUpdated ? 'balance-updated-anim' : ''
                } ${isZeroBalance ? 'balance-result-zero' : ''}`}
                data-testid="balance-display"
              >
                <div className="balance-value-group">
                  <span className="balance-label">Balance:</span>
                  <span className="balance-value">
                    <CoinsIcon className="balance-coin-icon" />
                    {balance}
                  </span>
                </div>
                <div className="balance-auto-refresh" data-testid="auto-refresh-indicator">
                  <span className={`refresh-dot ${isRefreshing ? 'refresh-dot-active' : ''}`} />
                  <span>Auto-refreshes every 30s</span>
                </div>
              </div>

              {/* Empty State (0 TON) with helpful illustration, text & testnet faucet link (Task 4) */}
              {isZeroBalance && (
                <div className="balance-empty-state" data-testid="empty-balance-state">
                  <div className="empty-state-icon-wrapper" aria-hidden="true">
                    <EmptyVaultIcon className="empty-state-svg" />
                  </div>
                  <div className="empty-state-content">
                    <span className="empty-state-badge">АККАУНТ НЕ ПОПОЛНЕН</span>
                    <h3 className="empty-state-title">Кошелёк пуст (0 TON)</h3>
                    <p className="empty-state-desc">
                      На этом адресе пока нет средств. Для тестирования транзакций и смарт-контрактов
                      запросите бесплатные тестовые монеты через официальный TON Testnet Faucet.
                    </p>
                    <a
                      href="https://t.me/testgiver_ton_bot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-faucet-link"
                      data-testid="faucet-link"
                    >
                      <ExternalLinkIcon className="faucet-icon" />
                      <span>Получить тестовые TON (Faucet)</span>
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>

        <CardFooter className="wallet-card-footer">
          <span className="footer-note">
            HEXAGON PROTOCOL ✦ TESTNET NODE EXPLORER ✦ ZERO LOGGING
          </span>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CheckBalance;
