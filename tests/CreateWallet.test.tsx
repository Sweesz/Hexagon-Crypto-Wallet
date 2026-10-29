// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateWallet } from '../src/components/CreateWallet';

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

    expect(screen.getByText('Create Wallet')).toBeDefined();

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
});
