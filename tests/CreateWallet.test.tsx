// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateWallet } from '../src/components/CreateWallet';
import {
  hasEncryptedWallet,
  ENCRYPTED_WALLET_STORAGE_KEY,
  decryptStoredWalletSecrets,
  encryptAndStoreWalletSecrets,
} from '../src/wallet/secureStorage';

// Fix cross-realm TypedArray issue in jsdom environment for tweetnacl / @ton/crypto
if (typeof Uint8Array !== 'undefined') {
  Object.defineProperty(Uint8Array, Symbol.hasInstance, {
    value: (inst: unknown) =>
      inst != null &&
      (Object.prototype.toString.call(inst) === '[object Uint8Array]' ||
        Uint8Array.prototype.isPrototypeOf(inst as object)),
    configurable: true,
  });
}

describe('CreateWallet component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial scaffold correctly with empty fields and enabled generate button', () => {
    render(<CreateWallet />);

    expect(screen.getByText('CREATE WALLET')).toBeDefined();

    const generateBtn = screen.getByTestId('generate-button');
    expect(generateBtn).toBeDefined();
    expect(generateBtn.textContent).toContain('Generate New Wallet');
    expect((generateBtn as HTMLButtonElement).disabled).toBe(false);

    const addressInput = screen.getByTestId('wallet-address') as HTMLInputElement;
    expect(addressInput).toBeDefined();
    expect(addressInput.readOnly).toBe(true);
    expect(addressInput.value).toBe('');

    const mnemonicTextarea = screen.getByTestId('mnemonic-phrase') as HTMLTextAreaElement;
    expect(mnemonicTextarea).toBeDefined();
    expect(mnemonicTextarea.readOnly).toBe(true);
    expect(mnemonicTextarea.value).toBe('');

    const copyBtn = screen.getByTestId('copy-button') as HTMLButtonElement;
    expect(copyBtn).toBeDefined();
    expect(copyBtn.disabled).toBe(true);

    const continueBtn = screen.getByTestId('continue-button') as HTMLButtonElement;
    expect(continueBtn).toBeDefined();
    expect(continueBtn.disabled).toBe(true);
  });

  it('generates a valid V4R2 address and 24-word mnemonic when clicking "Generate New Wallet"', async () => {
    const startTime = Date.now();
    render(<CreateWallet />);

    const generateBtn = screen.getByTestId('generate-button');
    fireEvent.click(generateBtn);

    // Wait for generation to complete
    const mnemonicTextarea = screen.getByTestId('mnemonic-phrase') as HTMLTextAreaElement;
    await waitFor(
      () => {
        expect(mnemonicTextarea.value).not.toBe('');
      },
      { timeout: 3000 }
    );

    const duration = Date.now() - startTime;
    // AC1: Within < 2 seconds
    expect(duration).toBeLessThan(2000);

    const addressInput = screen.getByTestId('wallet-address') as HTMLInputElement;
    // Valid TON testnet/mainnet user-friendly format
    expect(addressInput.value).toMatch(/^[0kE][Q1][A-Za-z0-9_-]{46}$/);

    // Mnemonic must be 24 words
    const words = mnemonicTextarea.value.trim().split(/\s+/);
    expect(words).toHaveLength(24);
  });

  it('shows loading state while generating keys', async () => {
    render(<CreateWallet />);

    const generateBtn = screen.getByTestId('generate-button') as HTMLButtonElement;
    fireEvent.click(generateBtn);

    // Immediately after click, loading state should be active
    expect(generateBtn.disabled).toBe(true);
    expect(generateBtn.textContent).toContain('Generating Keys...');

    // Wait for finish
    await waitFor(() => {
      expect(generateBtn.disabled).toBe(false);
      expect(generateBtn.textContent).toContain('Generate New Wallet');
    });
  });

  it('copies mnemonic to clipboard and shows toast feedback', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<CreateWallet />);

    // Generate wallet first
    const generateBtn = screen.getByTestId('generate-button');
    fireEvent.click(generateBtn);

    const copyBtn = screen.getByTestId('copy-button') as HTMLButtonElement;
    await waitFor(() => {
      expect(copyBtn.disabled).toBe(false);
    });

    const mnemonicTextarea = screen.getByTestId('mnemonic-phrase') as HTMLTextAreaElement;
    const mnemonicValue = mnemonicTextarea.value;

    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(mnemonicValue);
    });

    // Toast feedback appears
    const toast = await screen.findByTestId('wallet-toast');
    expect(toast).toBeDefined();
    expect(toast.textContent).toContain('Mnemonic copied to clipboard!');
  });

  it('falls back to document.execCommand when clipboard API fails (mobile/legacy fallback)', async () => {
    // Break navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    render(<CreateWallet />);

    const generateBtn = screen.getByTestId('generate-button');
    fireEvent.click(generateBtn);

    const copyBtn = screen.getByTestId('copy-button') as HTMLButtonElement;
    await waitFor(() => {
      expect(copyBtn.disabled).toBe(false);
    });

    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(execCommandMock).toHaveBeenCalledWith('copy');
    });

    const toast = await screen.findByTestId('wallet-toast');
    expect(toast.textContent).toContain('Mnemonic copied to clipboard!');
  });

  it('does not log mnemonic to console or store it in plaintext localStorage (AC2)', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log');
    const consoleInfoSpy = vi.spyOn(console, 'info');
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    const consoleErrorSpy = vi.spyOn(console, 'error');

    render(<CreateWallet />);

    const generateBtn = screen.getByTestId('generate-button');
    fireEvent.click(generateBtn);

    const mnemonicTextarea = screen.getByTestId('mnemonic-phrase') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(mnemonicTextarea.value).not.toBe('');
    });

    const mnemonicValue = mnemonicTextarea.value;

    // Check localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        expect(localStorage.getItem(key)).not.toContain(mnemonicValue);
      }
    }
    expect(localStorage.getItem('mnemonic')).toBeNull();

    // Check console spies
    const allConsoleCalls = [
      ...consoleLogSpy.mock.calls,
      ...consoleInfoSpy.mock.calls,
      ...consoleWarnSpy.mock.calls,
      ...consoleErrorSpy.mock.calls,
    ];

    allConsoleCalls.forEach((args) => {
      const serialized = JSON.stringify(args);
      expect(serialized).not.toContain(mnemonicValue);
    });
  });

  /* ========================================================================
     New Issue Acceptance Criteria Tests
     ======================================================================== */

  it('implements blur-until-confirmed pattern for mnemonic display (Task 3)', async () => {
    render(<CreateWallet />);

    const generateBtn = screen.getByTestId('generate-button');
    fireEvent.click(generateBtn);

    const mnemonicTextarea = screen.getByTestId('mnemonic-phrase') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(mnemonicTextarea.value).not.toBe('');
    });

    // Initial state: blur overlay is present and textarea has is-blurred class
    const blurOverlay = screen.getByTestId('mnemonic-blur-overlay');
    expect(blurOverlay).toBeDefined();
    expect(mnemonicTextarea.className).toContain('is-blurred');

    const toggleBtn = screen.getByTestId('toggle-reveal-button');
    expect(toggleBtn.textContent).toContain('Показать фразу');

    // Click toggle button to reveal
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId('mnemonic-blur-overlay')).toBeNull();
    expect(mnemonicTextarea.className).not.toContain('is-blurred');
    expect(toggleBtn.textContent).toContain('Скрыть фразу');

    // Click toggle button again to hide/blur
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('mnemonic-blur-overlay')).toBeDefined();
    expect(mnemonicTextarea.className).toContain('is-blurred');
  });

  it('provides visual feedback on copy button (icon/text changes to Copied) (AC 3)', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<CreateWallet />);

    const generateBtn = screen.getByTestId('generate-button');
    fireEvent.click(generateBtn);

    const copyBtn = screen.getByTestId('copy-button') as HTMLButtonElement;
    await waitFor(() => {
      expect(copyBtn.disabled).toBe(false);
    });

    expect(copyBtn.textContent).toContain('Copy to Clipboard');

    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(copyBtn.textContent).toContain('Copied to Clipboard!');
      expect(copyBtn.className).toContain('btn-copy-success');
    });
  });

  it('enables Continue button only when "I\'ve saved it" checkbox is checked (Task 4)', async () => {
    render(<CreateWallet />);

    const continueBtn = screen.getByTestId('continue-button') as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(true);

    const generateBtn = screen.getByTestId('generate-button');
    fireEvent.click(generateBtn);

    await waitFor(() => {
      const mnemonicTextarea = screen.getByTestId('mnemonic-phrase') as HTMLTextAreaElement;
      expect(mnemonicTextarea.value).not.toBe('');
    });

    // Still disabled before checking the checkbox
    expect(continueBtn.disabled).toBe(true);

    const checkbox = screen.getByTestId('confirm-saved-checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    // Check the checkbox
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(continueBtn.disabled).toBe(false);

    // Uncheck disables it again
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
    expect(continueBtn.disabled).toBe(true);
  });

  it('encrypts and stores wallet data on continue via secureStorage.ts (Task 5 & AC 4)', async () => {
    render(<CreateWallet />);

    const generateBtn = screen.getByTestId('generate-button');
    fireEvent.click(generateBtn);

    await waitFor(() => {
      const mnemonicTextarea = screen.getByTestId('mnemonic-phrase') as HTMLTextAreaElement;
      expect(mnemonicTextarea.value).not.toBe('');
    });

    const checkbox = screen.getByTestId('confirm-saved-checkbox');
    fireEvent.click(checkbox);

    const passwordInput = screen.getByTestId('wallet-encryption-password') as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: 'SecretMasterPassword123!' } });

    const continueBtn = screen.getByTestId('continue-button');
    fireEvent.click(continueBtn);

    // Should store encrypted wallet in localStorage
    await waitFor(
      () => {
        expect(hasEncryptedWallet()).toBe(true);
      },
      { timeout: 5000 }
    );

    // Verify stored data is properly encrypted and decryptable with the password
    const rawEnvelope = localStorage.getItem(ENCRYPTED_WALLET_STORAGE_KEY);
    expect(rawEnvelope).toBeTruthy();

    const decrypted = await decryptStoredWalletSecrets('SecretMasterPassword123!');
    const mnemonicTextarea = screen.getByTestId('mnemonic-phrase') as HTMLTextAreaElement;
    expect(decrypted.mnemonic).toBe(mnemonicTextarea.value);

    // Toast feedback appears
    const toast = await screen.findByTestId('wallet-toast');
    expect(toast.textContent).toContain('Wallet encrypted and saved successfully!');
  });

  it('validates password requirement before encryption on continue (Task 6)', async () => {
    render(<CreateWallet />);

    const generateBtn = screen.getByTestId('generate-button');
    fireEvent.click(generateBtn);

    await waitFor(() => {
      const mnemonicTextarea = screen.getByTestId('mnemonic-phrase') as HTMLTextAreaElement;
      expect(mnemonicTextarea.value).not.toBe('');
    });

    const checkbox = screen.getByTestId('confirm-saved-checkbox');
    fireEvent.click(checkbox);

    // Leave password empty and click continue
    const continueBtn = screen.getByTestId('continue-button');
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(hasEncryptedWallet()).toBe(false);
    });

    const toast = await screen.findByTestId('wallet-toast');
    expect(toast.textContent).toContain('A non-empty password is required.');
  });

  it('detects persisted wallet on refresh and allows reset (AC 4)', async () => {
    // Seed encrypted wallet in localStorage before rendering (simulating refreshed browser)
    await encryptAndStoreWalletSecrets(
      'TestPassword123',
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      new Uint8Array(32).fill(1)
    );

    expect(hasEncryptedWallet()).toBe(true);

    render(<CreateWallet />);

    // Persisted banner should be visible
    const persistedBanner = screen.getByTestId('wallet-persisted-banner');
    expect(persistedBanner).toBeDefined();
    expect(persistedBanner.textContent).toContain('Зашифрованный кошелёк сохранён');

    // Reset button clears persisted wallet
    const resetBtn = screen.getByTestId('reset-wallet-button');
    fireEvent.click(resetBtn);

    expect(hasEncryptedWallet()).toBe(false);
    expect(screen.queryByTestId('wallet-persisted-banner')).toBeNull();
  });
});
