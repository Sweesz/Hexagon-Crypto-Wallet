import React, { useState, useRef, useEffect } from 'react';
import { generateWallet } from '../wallet/generateWallet';
import { useToast } from './Toast/ToastContext';
import { Skeleton } from './Skeleton/Skeleton';
import { parseAppError } from '../utils/errorHandler';
import './CreateWallet.css';

export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (!text) return false;

  // Try modern Clipboard API first
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback for mobile/older browsers or non-secure contexts
  try {
    if (typeof document !== 'undefined') {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch {
    return false;
  }

  return false;
};

export const CreateWallet: React.FC = () => {
  const [address, setAddress] = useState<string>('');
  const [mnemonic, setMnemonic] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fallbackToast, setFallbackToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useToast();

  const showToastFeedback = (message: string, isSuccess = true, errorObj?: unknown) => {
    // 1. Notify global toast provider (auto-dismiss 4s for success as per AC 3)
    if (isSuccess) {
      toast.showSuccess(message, { duration: 4000 });
    } else {
      toast.showError(errorObj ?? message, { message });
    }

    // 2. Maintain local fallback toast for backwards compatibility with isolated unit tests
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setFallbackToast(message);
    toastTimeoutRef.current = setTimeout(() => {
      setFallbackToast(null);
      toastTimeoutRef.current = null;
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const wallet = await generateWallet();
      setAddress(wallet.address);
      setMnemonic(wallet.mnemonics.join(' '));
      showToastFeedback('Wallet generated successfully!', true);
    } catch (err: unknown) {
      const parsed = parseAppError(err, 'Failed to generate new wallet');
      showToastFeedback(parsed.userMessage, false, err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMnemonic = async () => {
    if (!mnemonic) return;
    try {
      const copied = await copyToClipboard(mnemonic);
      if (copied) {
        showToastFeedback('Mnemonic copied to clipboard!', true);
      } else {
        showToastFeedback('Failed to copy mnemonic', false);
      }
    } catch (err: unknown) {
      showToastFeedback('Failed to copy mnemonic to clipboard', false, err);
    }
  };

  return (
    <div className="wallet-container">
      <div className="wallet-card">
        <h2 className="wallet-title">Create Wallet</h2>

        <div className="wallet-section">
          <button
            type="button"
            className="btn-primary"
            onClick={handleGenerate}
            disabled={isLoading}
            data-testid="generate-button"
          >
            {isLoading ? 'Generating Keys...' : 'Generate New Wallet'}
          </button>
        </div>

        <div className="wallet-section">
          <label htmlFor="wallet-address" className="wallet-label">
            Wallet Address:
          </label>
          {isLoading && (
            <Skeleton variant="rectangular" width="100%" height="4px" dataTestId="address-skeleton" />
          )}
          <input
            id="wallet-address"
            data-testid="wallet-address"
            className="wallet-input wallet-readonly-input"
            type="text"
            readOnly
            value={address}
            placeholder={isLoading ? "Generating address..." : "Click 'Generate New Wallet' to create"}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="wallet-section">
          <label htmlFor="mnemonic-phrase" className="wallet-label">
            Mnemonic Phrase (24 words):
          </label>
          {isLoading && (
            <Skeleton variant="rectangular" width="100%" height="4px" dataTestId="mnemonic-skeleton" />
          )}
          <textarea
            id="mnemonic-phrase"
            data-testid="mnemonic-phrase"
            className="wallet-textarea"
            rows={4}
            readOnly
            value={mnemonic}
            placeholder={isLoading ? "Generating recovery phrase..." : "Your 24-word recovery phrase will appear here"}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="wallet-section">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCopyMnemonic}
            disabled={!mnemonic || isLoading}
            data-testid="copy-button"
          >
            Copy to Clipboard
          </button>
        </div>

        {fallbackToast && (
          <div className="wallet-toast" role="status" aria-live="polite" data-testid="wallet-toast">
            {fallbackToast}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateWallet;
