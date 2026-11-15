import React, { useState, useRef, useEffect } from 'react';
import { generateWallet } from '../wallet/generateWallet';
import {
  encryptAndStoreWalletSecrets,
  hasEncryptedWallet,
  removeEncryptedWallet,
} from '../wallet/secureStorage';
import { useToast } from './Toast/ToastContext';
import { Skeleton } from './Skeleton/Skeleton';
import { Button } from './Button/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card/Card';
import { Input } from './Input/Input';
import { parseAppError } from '../utils/errorHandler';
import type { GeneratedWallet } from '../wallet/types';
import './CreateWallet.css';

/* Minimalist bespoke inline SVGs — zero emoji rule */
const LockIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ShieldLockIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <circle cx="12" cy="11" r="2" />
    <path d="M12 13v3" />
  </svg>
);

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
  const [walletSecrets, setWalletSecrets] = useState<GeneratedWallet | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Security & UX states
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [hasSavedConfirmed, setHasSavedConfirmed] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPersisted, setIsPersisted] = useState<boolean>(false);
  const [isSuccessfullySaved, setIsSuccessfullySaved] = useState<boolean>(false);

  // Local fallback toast for backward compatibility with isolated unit tests
  const [fallbackToast, setFallbackToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useToast();

  // Check if encrypted wallet is already persisted on initial mount / page refresh
  useEffect(() => {
    if (typeof window !== 'undefined' && hasEncryptedWallet()) {
      setIsPersisted(true);
    }
  }, []);

  const showToastFeedback = (message: string, isSuccess = true, errorObj?: unknown) => {
    if (isSuccess) {
      toast.showSuccess(message, { duration: 4000 });
    } else {
      toast.showError(errorObj ?? message, { message });
    }

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
      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const handleGenerate = async () => {
    setIsLoading(true);
    setIsRevealed(false);
    setIsCopied(false);
    setHasSavedConfirmed(false);
    setIsSuccessfullySaved(false);
    setPasswordError(null);

    try {
      const wallet = await generateWallet();
      setWalletSecrets(wallet);
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
        setIsCopied(true);
        showToastFeedback('Mnemonic copied to clipboard!', true);

        if (copyResetTimeoutRef.current) {
          clearTimeout(copyResetTimeoutRef.current);
        }
        copyResetTimeoutRef.current = setTimeout(() => {
          setIsCopied(false);
          copyResetTimeoutRef.current = null;
        }, 3000);
      } else {
        showToastFeedback('Failed to copy mnemonic', false);
      }
    } catch (err: unknown) {
      showToastFeedback('Failed to copy mnemonic to clipboard', false, err);
    }
  };

  const handleToggleReveal = () => {
    setIsRevealed((prev) => !prev);
  };

  const handleContinue = async () => {
    if (!mnemonic || !walletSecrets) {
      showToastFeedback('Please generate a wallet first', false);
      return;
    }

    if (!hasSavedConfirmed) {
      showToastFeedback('Please confirm you have saved your recovery phrase', false);
      return;
    }

    if (!password || password.trim().length === 0) {
      setPasswordError('A non-empty password is required to encrypt your wallet.');
      showToastFeedback('A non-empty password is required.', false);
      return;
    }

    setIsSaving(true);
    setPasswordError(null);

    try {
      await encryptAndStoreWalletSecrets(password, mnemonic, walletSecrets.secretKey);
      setIsSuccessfullySaved(true);
      setIsPersisted(true);
      showToastFeedback('Wallet encrypted and saved successfully!', true);
    } catch (err: unknown) {
      const parsed = parseAppError(err, 'Failed to encrypt and store wallet');
      setPasswordError(parsed.userMessage);
      showToastFeedback(parsed.userMessage, false, err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPersistedWallet = () => {
    removeEncryptedWallet();
    setIsPersisted(false);
    setIsSuccessfullySaved(false);
    setAddress('');
    setMnemonic('');
    setWalletSecrets(null);
    setPassword('');
    setHasSavedConfirmed(false);
    setIsRevealed(false);
    showToastFeedback('Previous wallet cleared from local storage.', true);
  };

  const words = mnemonic ? mnemonic.trim().split(/\s+/) : [];

  return (
    <div className="wallet-container">
      {/* Editorial Brutalist Tape / Ribbon Banner with Marquee */}
      <div className="editorial-ribbon" role="banner" aria-label="Предупреждение о безопасности">
        <div className="editorial-ribbon-track">
          <span className="editorial-ribbon-segment">
            — НЕ ТВОИ КЛЮЧИ — НЕ ТВОИ МОНЕТЫ ✦ ВАШИ МОНЕТЫ — ВАШИ ПРАВИЛА ✦ HEXAGON WALLET ✦ НЕ ТВОИ КЛЮЧИ — НЕ ТВОИ МОНЕТЫ ✦&nbsp;
          </span>
          <span className="editorial-ribbon-segment" aria-hidden="true">
            — НЕ ТВОИ КЛЮЧИ — НЕ ТВОИ МОНЕТЫ ✦ ВАШИ МОНЕТЫ — ВАШИ ПРАВИЛА ✦ HEXAGON WALLET ✦ НЕ ТВОИ КЛЮЧИ — НЕ ТВОИ МОНЕТЫ ✦&nbsp;
          </span>
        </div>
      </div>

      <Card variant="paper" padding="lg" className="wallet-card">
        <CardHeader className="wallet-card-header">
          <div className="wallet-badge-row">
            <span className="wallet-badge">WEB3 / БЕЗ ПОСРЕДНИКОВ</span>
            <span className="wallet-badge-indicator">
              <span className="status-dot"></span> СЕТЬ РАБОТАЕТ
            </span>
          </div>
          <CardTitle as="h2" className="wallet-title text-display">
            CREATE WALLET
          </CardTitle>
          <CardDescription className="wallet-description">
            Покупайте, храните и управляйте криптовалютой. Сгенерируйте секретную фразу из 24 слов.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Persisted Wallet Status banner if wallet exists in localStorage */}
          {isPersisted && (
            <div className="wallet-persisted-banner" data-testid="wallet-persisted-banner">
              <div className="persisted-icon" aria-hidden="true">
                <ShieldLockIcon className="icon-gold" />
              </div>
              <div className="persisted-info">
                <span className="persisted-title">Зашифрованный кошелёк сохранён</span>
                <span className="persisted-desc">
                  Ваш кошелёк зашифрован с помощью AES-256-GCM и сохранён локально.
                </span>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleResetPersistedWallet}
                data-testid="reset-wallet-button"
                className="btn-reset-wallet"
              >
                Сбросить
              </Button>
            </div>
          )}

          {/* Section 1: Generate Action */}
          <div className="wallet-section">
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleGenerate}
              disabled={isLoading}
              isLoading={isLoading}
              data-testid="generate-button"
              className="btn-generate-main"
            >
              {isLoading ? 'Generating Keys...' : 'Generate New Wallet'}
            </Button>
          </div>

          {/* Section 2: Wallet Address */}
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
              className="wallet-input wallet-readonly-input text-mono"
              type="text"
              readOnly
              value={address}
              placeholder={isLoading ? 'Generating address...' : "Click 'Generate New Wallet' to create"}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {/* Section 3: Mnemonic Display with Blur-Until-Confirmed */}
          <div className="wallet-section mnemonic-display-section">
            <div className="mnemonic-header-row">
              <label htmlFor="mnemonic-phrase" className="wallet-label">
                Mnemonic Phrase (24 words):
              </label>
              {mnemonic && (
                <button
                  type="button"
                  className="btn-toggle-reveal"
                  onClick={handleToggleReveal}
                  data-testid="toggle-reveal-button"
                  aria-label={isRevealed ? 'Hide secret phrase' : 'Reveal secret phrase'}
                >
                  <span className="btn-reveal-icon" aria-hidden="true">
                    {isRevealed ? <EyeOffIcon /> : <EyeIcon />}
                  </span>
                  <span>{isRevealed ? 'Скрыть фразу' : 'Показать фразу'}</span>
                </button>
              )}
            </div>

            {isLoading && (
              <Skeleton variant="rectangular" width="100%" height="4px" dataTestId="mnemonic-skeleton" />
            )}

            <div className="mnemonic-container" data-testid="mnemonic-container">
              {/* Blur-until-confirmed overlay when mnemonic exists but not revealed */}
              {mnemonic && !isRevealed && (
                <div
                  className="mnemonic-blur-overlay"
                  data-testid="mnemonic-blur-overlay"
                  onClick={handleToggleReveal}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleToggleReveal()}
                  aria-label="Click to reveal secret recovery phrase"
                >
                  <div className="blur-stamp-badge" aria-hidden="true">
                    <LockIcon className="stamp-icon" />
                    <span>СЕКРЕТНЫЙ ДОСТУП</span>
                  </div>
                  <span className="blur-notice-title">Мнемоническая фраза скрыта</span>
                  <span className="blur-notice-sub">Нажмите, чтобы проявить 24 слова для записи</span>
                </div>
              )}

              {/* Numbered words grid for high-fidelity polished Figma representation */}
              {mnemonic && (
                <div
                  className={`mnemonic-words-grid ${!isRevealed ? 'is-blurred' : 'is-revealed'}`}
                  data-testid="mnemonic-words-grid"
                >
                  {words.map((word, index) => (
                    <div key={index} className="mnemonic-word-chip">
                      <span className="word-index">{index + 1}</span>
                      <span className="word-text text-mono">{word}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Accessible and test-compliant textarea for recovery phrase */}
              <textarea
                id="mnemonic-phrase"
                data-testid="mnemonic-phrase"
                className={`wallet-textarea text-mono ${mnemonic && !isRevealed ? 'is-blurred' : ''}`}
                rows={mnemonic ? 2 : 3}
                readOnly
                value={mnemonic}
                placeholder={isLoading ? 'Generating recovery phrase...' : 'Your 24-word recovery phrase will appear here'}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Section 4: Copy to Clipboard Button with visual feedback */}
          <div className="wallet-section copy-action-section">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={handleCopyMnemonic}
              disabled={!mnemonic || isLoading}
              data-testid="copy-button"
              className={isCopied ? 'btn-copy-success' : ''}
              leftIcon={isCopied ? <CheckIcon /> : undefined}
            >
              {isCopied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}
            </Button>
          </div>

          {/* Section 5: "I've saved it" Checkbox Confirmation */}
          <div className="wallet-section">
            <div className="wallet-checkbox-wrapper">
              <label htmlFor="confirm-saved-checkbox" className="wallet-checkbox-label">
                <input
                  type="checkbox"
                  id="confirm-saved-checkbox"
                  data-testid="confirm-saved-checkbox"
                  className="wallet-checkbox-input"
                  checked={hasSavedConfirmed}
                  onChange={(e) => setHasSavedConfirmed(e.target.checked)}
                  disabled={!mnemonic || isLoading}
                />
                <span className="wallet-checkbox-text">
                  <strong>I've saved it:</strong> I have safely backed up my 24-word recovery phrase offline.
                </span>
              </label>
            </div>
          </div>

          {/* Section 6: Encryption Password Input for secureStorage.ts */}
          {mnemonic && (
            <div className="wallet-section password-entry-section">
              <Input
                id="wallet-encryption-password"
                data-testid="wallet-encryption-password"
                type="password"
                label="Encryption Password:"
                placeholder="Enter password to encrypt wallet"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                disabled={isLoading || isSaving}
                error={Boolean(passwordError)}
                errorMessage={passwordError || undefined}
                helperText="Password is used with AES-256-GCM to securely encrypt your wallet secrets locally."
              />
            </div>
          )}

          {/* Section 7: Continue Button (Enabled when mnemonic generated & checkbox checked) */}
          <div className="wallet-section">
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleContinue}
              disabled={!mnemonic || isLoading || isSaving || !hasSavedConfirmed}
              isLoading={isSaving}
              data-testid="continue-button"
              className="btn-continue"
            >
              {isSaving ? 'Encrypting & Saving...' : 'Continue & Encrypt Wallet'}
            </Button>
          </div>

          {/* Success confirmation if saved */}
          {isSuccessfullySaved && (
            <div className="wallet-success-box" data-testid="wallet-success-box">
              <span className="success-icon" aria-hidden="true">
                <CheckIcon />
              </span>
              <span>Кошелёк успешно сохранён и зашифрован в защищённом хранилище.</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="wallet-card-footer">
          <span className="footer-note text-micro">
            * HEXAGON НЕ ХРАНИТ ВАШИ КЛЮЧИ И НЕ ИМЕЕТ ДОСТУПА К СРЕДСТВАМ
          </span>
        </CardFooter>

        {fallbackToast && (
          <div className="wallet-toast" role="status" aria-live="polite" data-testid="wallet-toast">
            {fallbackToast}
          </div>
        )}
      </Card>
    </div>
  );
};

export default CreateWallet;
