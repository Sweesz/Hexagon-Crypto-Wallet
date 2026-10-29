import React, { useState, useRef } from 'react';
import { generateWallet } from '../wallet/generateWallet';
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
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 2500);
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const wallet = await generateWallet();
      setAddress(wallet.address);
      setMnemonic(wallet.mnemonics.join(' '));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMnemonic = async () => {
    if (!mnemonic) return;
    const copied = await copyToClipboard(mnemonic);
    if (copied) {
      showToast('Mnemonic copied to clipboard!');
    } else {
      showToast('Failed to copy mnemonic');
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
          <input
            id="wallet-address"
            data-testid="wallet-address"
            className="wallet-input wallet-readonly-input"
            type="text"
            readOnly
            value={address}
            placeholder="Click 'Generate New Wallet' to create"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="wallet-section">
          <label htmlFor="mnemonic-phrase" className="wallet-label">
            Mnemonic Phrase (24 words):
          </label>
          <textarea
            id="mnemonic-phrase"
            data-testid="mnemonic-phrase"
            className="wallet-textarea"
            rows={4}
            readOnly
            value={mnemonic}
            placeholder="Your 24-word recovery phrase will appear here"
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

        {toast && (
          <div className="wallet-toast" role="status" aria-live="polite" data-testid="wallet-toast">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateWallet;
