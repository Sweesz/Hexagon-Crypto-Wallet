// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CheckBalance, isValidTonAddress, formatTonBalance } from '../src/components/CheckBalance';
import * as balanceModule from '../src/wallet/getBalance';

// Valid addresses for testing
const VALID_TESTNET_ADDRESS = '0QABI0VniavN7wEjRWeJq83vASNFZ4mrze8BI0VniavN70dx';
const VALID_RAW_ADDRESS = '0:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const INVALID_ADDRESS = 'invalid-malformed-address-string';

describe('CheckBalance component & helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Helper functions', () => {
    it('isValidTonAddress correctly validates TON addresses', () => {
      expect(isValidTonAddress(VALID_TESTNET_ADDRESS)).toBe(true);
      expect(isValidTonAddress(VALID_RAW_ADDRESS)).toBe(true);
      expect(isValidTonAddress(INVALID_ADDRESS)).toBe(false);
      expect(isValidTonAddress('')).toBe(false);
      expect(isValidTonAddress('   ')).toBe(false);
    });

    it('formatTonBalance formats nano-tons correctly', () => {
      expect(formatTonBalance(0n)).toBe('0 TON');
      expect(formatTonBalance(5000000000n)).toBe('5 TON');
      expect(formatTonBalance(1234000000n)).toBe('1.234 TON');
      expect(formatTonBalance(10000000000n)).toBe('10 TON');
    });

    it('formatTonBalance formats thousands with commas and handles edge cases (e.g. 1,234.56 TON)', () => {
      // Specified in ticket task: 1,234.56 TON
      expect(formatTonBalance(1234560000000n)).toBe('1,234.56 TON');
      // Large balance with millions
      expect(formatTonBalance(1000000000000000000n)).toBe('1,000,000,000 TON');
      // Fractional large balance
      expect(formatTonBalance(1234567890000000n)).toBe('1,234,567.89 TON');
      // Very small nano amount (1 nanoTON) without scientific notation
      expect(formatTonBalance(1n)).toBe('0.000000001 TON');
      // Small amount with leading zeros in decimals
      expect(formatTonBalance(1000000001n)).toBe('1.000000001 TON');
    });
  });

  describe('UI and basic interaction', () => {
    it('renders input field and check button', () => {
      render(<CheckBalance />);

      const input = screen.getByPlaceholderText('Enter TON address');
      const button = screen.getByRole('button', { name: /check balance/i });

      expect(input).toBeDefined();
      expect(button).toBeDefined();
      expect(screen.queryByTestId('balance-display')).toBeNull();
      expect(screen.queryByTestId('loading-spinner')).toBeNull();
      expect(screen.queryByTestId('error-message')).toBeNull();
    });

    it('allows user to type an address', () => {
      render(<CheckBalance />);

      const input = screen.getByPlaceholderText('Enter TON address') as HTMLInputElement;
      fireEvent.change(input, { target: { value: VALID_TESTNET_ADDRESS } });

      expect(input.value).toBe(VALID_TESTNET_ADDRESS);
    });
  });

  describe('Acceptance Criteria 1: Valid Testnet address shows formatted balance', () => {
    it('fetches and displays balance formatted as "X.XXX TON" upon clicking button', async () => {
      const getBalanceMock = vi.spyOn(balanceModule, 'getBalance').mockResolvedValue(1234000000n);

      render(<CheckBalance />);

      const input = screen.getByPlaceholderText('Enter TON address');
      const button = screen.getByRole('button', { name: /check balance/i });

      fireEvent.change(input, { target: { value: VALID_TESTNET_ADDRESS } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('balance-display')).toBeDefined();
      });

      const balanceDisplay = screen.getByTestId('balance-display');
      expect(balanceDisplay.textContent).toContain('1.234 TON');
      expect(getBalanceMock).toHaveBeenCalledWith(VALID_TESTNET_ADDRESS);
    });

    it('displays integer TON values properly (e.g. 10 TON)', async () => {
      vi.spyOn(balanceModule, 'getBalance').mockResolvedValue(10000000000n);

      render(<CheckBalance />);

      const input = screen.getByPlaceholderText('Enter TON address');
      const button = screen.getByRole('button', { name: /check balance/i });

      fireEvent.change(input, { target: { value: VALID_TESTNET_ADDRESS } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('balance-display')).toBeDefined();
      });

      const balanceDisplay = screen.getByTestId('balance-display');
      expect(balanceDisplay.textContent).toContain('10 TON');
    });
  });

  describe('Acceptance Criteria 2: Uninitialized address shows "0 TON" & Empty State (Task 4)', () => {
    it('displays "0 TON" (not an error) when getBalance returns 0n', async () => {
      vi.spyOn(balanceModule, 'getBalance').mockResolvedValue(0n);

      render(<CheckBalance />);

      const input = screen.getByPlaceholderText('Enter TON address');
      const button = screen.getByRole('button', { name: /check balance/i });

      fireEvent.change(input, { target: { value: VALID_TESTNET_ADDRESS } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('balance-display')).toBeDefined();
      });

      const balanceDisplay = screen.getByTestId('balance-display');
      expect(balanceDisplay.textContent).toContain('0 TON');
      expect(screen.queryByTestId('error-message')).toBeNull();
    });

    it('renders empty state card with illustration, helpful text and testnet faucet link when balance is 0 TON', async () => {
      vi.spyOn(balanceModule, 'getBalance').mockResolvedValue(0n);

      render(<CheckBalance />);

      const input = screen.getByPlaceholderText('Enter TON address');
      const button = screen.getByRole('button', { name: /check balance/i });

      fireEvent.change(input, { target: { value: VALID_TESTNET_ADDRESS } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('empty-balance-state')).toBeDefined();
      });

      const emptyState = screen.getByTestId('empty-balance-state');
      expect(emptyState.textContent).toContain('Кошелёк пуст (0 TON)');

      const faucetLink = screen.getByTestId('faucet-link') as HTMLAnchorElement;
      expect(faucetLink).toBeDefined();
      expect(faucetLink.href).toContain('https://t.me/testgiver_ton_bot');
      expect(faucetLink.target).toBe('_blank');
    });

    it('does not render empty state card when balance is positive (> 0 TON)', async () => {
      vi.spyOn(balanceModule, 'getBalance').mockResolvedValue(5000000000n);

      render(<CheckBalance />);

      const input = screen.getByPlaceholderText('Enter TON address');
      const button = screen.getByRole('button', { name: /check balance/i });

      fireEvent.change(input, { target: { value: VALID_TESTNET_ADDRESS } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('balance-display')).toBeDefined();
      });

      expect(screen.queryByTestId('empty-balance-state')).toBeNull();
      expect(screen.getByTestId('balance-display').textContent).toContain('5 TON');
    });
  });

  describe('Acceptance Criteria 4: Input validation prevents API calls for malformed strings', () => {
    it('prevents API calls and displays error when malformed string is entered', async () => {
      const getBalanceMock = vi.spyOn(balanceModule, 'getBalance').mockResolvedValue(5000000000n);

      render(<CheckBalance />);

      const input = screen.getByPlaceholderText('Enter TON address');
      fireEvent.change(input, { target: { value: INVALID_ADDRESS } });

      const button = screen.getByRole('button', { name: /check balance/i });
      fireEvent.click(button);

      expect(getBalanceMock).not.toHaveBeenCalled();

      const errorMsg = screen.getByTestId('error-message');
      expect(errorMsg.textContent).toContain('Invalid TON address format');
      expect(screen.queryByTestId('balance-display')).toBeNull();
    });

    it('shows error when check button is clicked with empty input without calling API', () => {
      const getBalanceMock = vi.spyOn(balanceModule, 'getBalance').mockResolvedValue(5000000000n);

      render(<CheckBalance />);

      const button = screen.getByRole('button', { name: /check balance/i });
      fireEvent.click(button);

      expect(getBalanceMock).not.toHaveBeenCalled();
      const errorMsg = screen.getByTestId('error-message');
      expect(errorMsg.textContent).toContain('Please enter a TON address');
    });
  });

  describe('Task 2: Real-time balance fetching on valid address input', () => {
    it('automatically triggers balance fetching after typing valid address (debounced)', async () => {
      vi.useFakeTimers();
      const getBalanceMock = vi.spyOn(balanceModule, 'getBalance').mockResolvedValue(5000000000n);

      render(<CheckBalance />);

      const input = screen.getByPlaceholderText('Enter TON address');
      fireEvent.change(input, { target: { value: VALID_TESTNET_ADDRESS } });

      // Before debounce timer, getBalance has not been called
      expect(getBalanceMock).not.toHaveBeenCalled();

      // Fast-forward debounce timer (350ms)
      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      expect(getBalanceMock).toHaveBeenCalledWith(VALID_TESTNET_ADDRESS);

      // Resolve promise
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByTestId('balance-display').textContent).toContain('5 TON');
    });
  });

  describe('Task 4: Loading spinner during API call', () => {
    it('shows loading spinner and disables button while request is in flight', async () => {
      let resolvePromise: (val: bigint) => void;
      const delayedPromise = new Promise<bigint>((resolve) => {
        resolvePromise = resolve;
      });
      vi.spyOn(balanceModule, 'getBalance').mockReturnValue(delayedPromise);

      render(<CheckBalance />);

      const input = screen.getByPlaceholderText('Enter TON address');
      const button = screen.getByRole('button', { name: /check balance/i });

      fireEvent.change(input, { target: { value: VALID_TESTNET_ADDRESS } });
      fireEvent.click(button);

      // Loading state should now be active
      expect(screen.getByTestId('loading-spinner')).toBeDefined();
      expect(button.textContent).toContain('Checking...');
      expect((button as HTMLButtonElement).disabled).toBe(true);

      // Resolve API response
      await act(async () => {
        resolvePromise!(2000000000n);
      });

      // Spinner should disappear, balance display shows result
      expect(screen.queryByTestId('loading-spinner')).toBeNull();
      expect(screen.getByTestId('balance-display').textContent).toContain('2 TON');
    });
  });

  describe('Acceptance Criteria 3: Network timeout shows retry option after 10 seconds', () => {
    it('shows timeout error and retry option after 10 seconds of unresolved request', async () => {
      vi.useFakeTimers();
      // Promise that never resolves immediately to simulate network stall
      const neverResolvingPromise = new Promise<bigint>(() => {});
      const getBalanceMock = vi.spyOn(balanceModule, 'getBalance').mockReturnValue(neverResolvingPromise);

      render(<CheckBalance />);

      const input = screen.getByPlaceholderText('Enter TON address');
      const button = screen.getByRole('button', { name: /check balance/i });

      fireEvent.change(input, { target: { value: VALID_TESTNET_ADDRESS } });
      fireEvent.click(button);

      expect(screen.getByTestId('loading-spinner')).toBeDefined();

      // Advance by 9 seconds: still loading, no timeout yet
      await act(async () => {
        vi.advanceTimersByTime(9000);
      });
      expect(screen.queryByTestId('retry-button')).toBeNull();

      // Advance past 10 seconds
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      // Timeout triggered
      expect(screen.queryByTestId('loading-spinner')).toBeNull();
      const errorMessage = screen.getByTestId('error-message');
      expect(errorMessage.textContent).toContain('Request timed out after 10 seconds');

      const retryBtn = screen.getByTestId('retry-button');
      expect(retryBtn).toBeDefined();

      // Clicking retry triggers a new request
      getBalanceMock.mockResolvedValueOnce(3000000000n);
      await act(async () => {
        fireEvent.click(retryBtn);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByTestId('balance-display').textContent).toContain('3 TON');
    });

    it('shows network failure message and retry button on network error', async () => {
      vi.spyOn(balanceModule, 'getBalance').mockRejectedValue(new Error('Failed to fetch balance: NetworkError'));

      render(<CheckBalance />);

      const input = screen.getByPlaceholderText('Enter TON address');
      const button = screen.getByRole('button', { name: /check balance/i });

      fireEvent.change(input, { target: { value: VALID_TESTNET_ADDRESS } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeDefined();
      });

      expect(screen.getByTestId('error-message').textContent).toContain('Network failure');
      expect(screen.getByTestId('retry-button')).toBeDefined();
    });
  });

  describe('Task 6: Auto-refresh balance every 30 seconds when wallet is active', () => {
    it('refreshes the balance every 30 seconds', async () => {
      vi.useFakeTimers();
      const getBalanceMock = vi
        .spyOn(balanceModule, 'getBalance')
        .mockResolvedValueOnce(1000000000n) // 1 TON
        .mockResolvedValueOnce(2000000000n) // 2 TON on first refresh
        .mockResolvedValueOnce(3000000000n); // 3 TON on second refresh

      render(<CheckBalance />);

      const input = screen.getByPlaceholderText('Enter TON address');
      const button = screen.getByRole('button', { name: /check balance/i });

      fireEvent.change(input, { target: { value: VALID_TESTNET_ADDRESS } });
      fireEvent.click(button);

      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByTestId('balance-display').textContent).toContain('1 TON');
      expect(getBalanceMock).toHaveBeenCalledTimes(1);

      // Advance by 30 seconds
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(getBalanceMock).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('balance-display').textContent).toContain('2 TON');

      // Advance another 30 seconds
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(getBalanceMock).toHaveBeenCalledTimes(3);
      expect(screen.getByTestId('balance-display').textContent).toContain('3 TON');
    });

    it('renders the auto-refresh indicator badge and applies update animation', async () => {
      vi.useFakeTimers();
      vi.spyOn(balanceModule, 'getBalance').mockResolvedValue(5000000000n);

      render(<CheckBalance />);

      const input = screen.getByPlaceholderText('Enter TON address');
      const button = screen.getByRole('button', { name: /check balance/i });

      fireEvent.change(input, { target: { value: VALID_TESTNET_ADDRESS } });
      fireEvent.click(button);

      await act(async () => {
        await Promise.resolve();
      });

      const indicator = screen.getByTestId('auto-refresh-indicator');
      expect(indicator).toBeDefined();
      expect(indicator.textContent).toContain('Auto-refreshes every 30s');

      const balanceCard = screen.getByTestId('balance-display');
      expect(balanceCard.className).toContain('balance-updated-anim');

      // Fast-forward animation timer (1200ms)
      await act(async () => {
        vi.advanceTimersByTime(1200);
      });

      expect(balanceCard.className).not.toContain('balance-updated-anim');
    });
  });

  describe('Design System: Editorial Brutalist UI elements matching CreateWallet', () => {
    it('renders editorial ribbon banner, live network badge, and card footer', () => {
      render(<CheckBalance />);

      expect(screen.getByRole('banner')).toBeDefined();
      expect(screen.getAllByText(/БАЛАНС В РЕАЛЬНОМ ВРЕМЕНИ/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/СЕТЬ АКТИВНА/i)).toBeDefined();
      expect(screen.getByRole('heading', { level: 2, name: /CHECK BALANCE/i })).toBeDefined();
      expect(screen.getByText(/HEXAGON PROTOCOL/i)).toBeDefined();
    });
  });
});
