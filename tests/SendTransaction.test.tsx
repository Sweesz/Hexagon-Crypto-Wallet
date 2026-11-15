// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Address } from '@ton/core';
import { SendTransaction } from '../src/components/SendTransaction';
import { ToastProvider } from '../src/components/Toast';
import * as sendTransactionModule from '../src/wallet/sendTransaction';

describe('SendTransaction Component (Tasks & Acceptance Criteria)', () => {
  const sampleMnemonics = [
    'apple', 'banana', 'orange', 'grape', 'lemon', 'peach',
    'cherry', 'melon', 'mango', 'kiwi', 'plum', 'berry',
    'apricot', 'lime', 'fig', 'pear', 'coconut', 'papaya',
    'avocado', 'guava', 'date', 'olive', 'walnut', 'almond',
  ];

  const sampleAddressObj = new Address(
    0,
    Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex')
  );
  const sampleAddressStr = sampleAddressObj.toString({
    bounceable: false,
    urlSafe: true,
    testOnly: true,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithToast = (ui: React.ReactElement) => {
    return render(<ToastProvider>{ui}</ToastProvider>);
  };

  describe('Task 1: Style Send form inputs per design', () => {
    it('renders form inputs for address, amount, comment and action button', () => {
      renderWithToast(<SendTransaction senderMnemonics={sampleMnemonics} />);

      expect(screen.getByTestId('send-form-container')).toBeDefined();
      expect(screen.getByText('SEND TON')).toBeDefined();
      expect(screen.getByTestId('input-receiver-address')).toBeDefined();
      expect(screen.getByTestId('input-amount')).toBeDefined();
      expect(screen.getByTestId('input-comment')).toBeDefined();
      expect(screen.getByTestId('btn-review')).toBeDefined();
      expect(screen.getByTestId('security-note')).toBeDefined();
    });

    it('populates amount via quick selector pills', () => {
      renderWithToast(<SendTransaction senderMnemonics={sampleMnemonics} />);

      const pill1Ton = screen.getByRole('button', { name: '+1 TON' });
      fireEvent.click(pill1Ton);

      const amountInput = screen.getByTestId('input-amount') as HTMLInputElement;
      expect(amountInput.value).toBe('1');
    });
  });

  describe('Task 2 & AC 2: Client-side validation via validateTransaction.ts with inline error messages', () => {
    it('shows inline errors below relevant fields when Review is clicked on empty form (no alert/popup)', () => {
      renderWithToast(<SendTransaction senderMnemonics={sampleMnemonics} />);

      const reviewBtn = screen.getByTestId('btn-review');
      fireEvent.click(reviewBtn);

      // Errors must appear inline as alerts in the DOM, not as window.alert
      const addressError = screen.getByTestId('error-receiver-address');
      expect(addressError).toBeDefined();
      expect(addressError.textContent).toContain('Invalid TON address format');

      const amountError = screen.getByTestId('error-amount');
      expect(amountError).toBeDefined();
      expect(amountError.textContent).toContain('Amount must be greater than 0');

      // Modal must NOT open
      expect(screen.queryByTestId('transaction-confirm-modal')).toBeNull();
    });

    it('validates invalid address inline instantly on blur/change', () => {
      renderWithToast(<SendTransaction senderMnemonics={sampleMnemonics} />);

      const addressInput = screen.getByTestId('input-receiver-address');
      fireEvent.change(addressInput, { target: { value: 'invalid-address-string' } });
      fireEvent.blur(addressInput);

      const addressError = screen.getByTestId('error-receiver-address');
      expect(addressError.textContent).toContain('Invalid TON address format');
    });

    it('validates invalid amount (<= 0) inline instantly', () => {
      renderWithToast(<SendTransaction senderMnemonics={sampleMnemonics} />);

      const amountInput = screen.getByTestId('input-amount');
      fireEvent.change(amountInput, { target: { value: '0' } });
      fireEvent.blur(amountInput);

      const amountError = screen.getByTestId('error-amount');
      expect(amountError.textContent).toContain('Amount must be greater than 0');
    });

    it('validates comment exceeding 120 bytes inline', () => {
      renderWithToast(<SendTransaction senderMnemonics={sampleMnemonics} />);

      const commentInput = screen.getByTestId('input-comment');
      const longComment = 'a'.repeat(120); // 120 bytes >= 120 max
      fireEvent.change(commentInput, { target: { value: longComment } });
      fireEvent.blur(commentInput);

      const commentError = screen.getByTestId('error-comment');
      expect(commentError.textContent).toContain('Comment must be less than 120 bytes');

      // Byte counter must reflect warning/error
      const counter = screen.getByTestId('comment-byte-counter');
      expect(counter.textContent).toBe('120/120 bytes');
    });

    it('clears inline errors immediately when valid values are entered', () => {
      renderWithToast(<SendTransaction senderMnemonics={sampleMnemonics} />);

      const addressInput = screen.getByTestId('input-receiver-address');
      fireEvent.change(addressInput, { target: { value: 'bad' } });
      fireEvent.blur(addressInput);
      expect(screen.getByTestId('error-receiver-address')).toBeDefined();

      // Enter valid address
      fireEvent.change(addressInput, { target: { value: sampleAddressStr } });
      expect(screen.queryByTestId('error-receiver-address')).toBeNull();
    });
  });

  describe('Task 3 & AC 3: Connect Review button to open Confirmation Modal with populated data', () => {
    it('opens Confirmation Modal with populated exact values when form is valid', () => {
      renderWithToast(
        <SendTransaction
          senderMnemonics={sampleMnemonics}
          initialReceiver={sampleAddressStr}
          initialAmount="3.5"
          initialComment="Dinner payment"
        />
      );

      const reviewBtn = screen.getByTestId('btn-review');
      fireEvent.click(reviewBtn);

      // Modal is visible
      const modal = screen.getByTestId('transaction-confirm-modal');
      expect(modal).toBeDefined();

      // Displays exact values that will be sent on-chain (AC 3)
      expect(screen.getByTestId('amount-display').textContent).toBe('3.5 TON');
      expect(screen.getByTestId('comment-display').textContent).toBe('Dinner payment');
      expect(screen.getByTestId('receiver-address-display')).toBeDefined();
    });

    it('can cancel and close the modal without affecting form inputs', () => {
      renderWithToast(
        <SendTransaction
          senderMnemonics={sampleMnemonics}
          initialReceiver={sampleAddressStr}
          initialAmount="1.2"
        />
      );

      fireEvent.click(screen.getByTestId('btn-review'));
      expect(screen.getByTestId('transaction-confirm-modal')).toBeDefined();

      const cancelBtn = screen.getByTestId('modal-cancel-btn');
      fireEvent.click(cancelBtn);

      expect(screen.queryByTestId('transaction-confirm-modal')).toBeNull();

      // Form values are preserved
      expect((screen.getByTestId('input-receiver-address') as HTMLInputElement).value).toBe(sampleAddressStr);
      expect((screen.getByTestId('input-amount') as HTMLInputElement).value).toBe('1.2');
    });
  });

  describe('Task 4, 5, 6 & AC 1, 4, 5: Confirm Send, Feedback Loop & Form State Management', () => {
    it('binds Confirm Send to sendTransaction(), shows loading spinner, displays success toast with tx hash link, and resets form', async () => {
      const mockResult = {
        hash: 'b1a2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
        boc: 'te6cckEBAQEAAgAAAA==',
        seqno: 42,
      };

      // Mock sendTransaction implementation with a slight delay
      const sendTransactionSpy = vi
        .spyOn(sendTransactionModule, 'sendTransaction')
        .mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve(mockResult), 50);
            })
        );

      const onSuccessMock = vi.fn();

      renderWithToast(
        <SendTransaction
          senderMnemonics={sampleMnemonics}
          initialReceiver={sampleAddressStr}
          initialAmount="2.0"
          initialComment="Test transfer"
          onSuccess={onSuccessMock}
        />
      );

      // 1. Open Review modal
      fireEvent.click(screen.getByTestId('btn-review'));
      expect(screen.getByTestId('transaction-confirm-modal')).toBeDefined();

      // 2. Click Confirm Send
      const confirmBtn = screen.getByTestId('modal-confirm-btn');
      fireEvent.click(confirmBtn);

      // Verify loading spinner is shown in modal
      expect(screen.getByText('Sending...')).toBeDefined();

      // 3. Wait for sendTransaction to finish
      await waitFor(() => {
        expect(sendTransactionSpy).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(onSuccessMock).toHaveBeenCalledWith(mockResult);
      });

      // 4. Modal is closed
      expect(screen.queryByTestId('transaction-confirm-modal')).toBeNull();

      // 5. Success toast is displayed with tx hash link
      const txHashLink = await screen.findByTestId('tx-hash-link');
      expect(txHashLink).toBeDefined();
      expect(txHashLink.getAttribute('href')).toContain(
        `https://testnet.tonviewer.com/transaction/${mockResult.hash}`
      );

      // 6. Form is reset after successful send (Task requirement & AC 5)
      expect((screen.getByTestId('input-receiver-address') as HTMLInputElement).value).toBe('');
      expect((screen.getByTestId('input-amount') as HTMLInputElement).value).toBe('');
      expect((screen.getByTestId('input-comment') as HTMLInputElement).value).toBe('');
    });

    it('shows error toast on send failure and preserves form draft', async () => {
      const networkError = new Error('Network request failed: RPC timeout');
      const sendTransactionSpy = vi
        .spyOn(sendTransactionModule, 'sendTransaction')
        .mockRejectedValue(networkError);

      const onErrorMock = vi.fn();

      renderWithToast(
        <SendTransaction
          senderMnemonics={sampleMnemonics}
          initialReceiver={sampleAddressStr}
          initialAmount="5.0"
          initialComment="Draft to preserve"
          onError={onErrorMock}
        />
      );

      // Open Review modal
      fireEvent.click(screen.getByTestId('btn-review'));
      expect(screen.getByTestId('transaction-confirm-modal')).toBeDefined();

      // Click Confirm Send
      const confirmBtn = screen.getByTestId('modal-confirm-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(sendTransactionSpy).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(onErrorMock).toHaveBeenCalledWith(networkError);
      });

      // Modal closed
      expect(screen.queryByTestId('transaction-confirm-modal')).toBeNull();

      // Error toast shown
      const toastItem = await screen.findByTestId('wallet-toast');
      expect(toastItem.getAttribute('data-toast-type')).toBe('error');

      // CRITICAL: Draft is preserved on error (AC 5)
      expect((screen.getByTestId('input-receiver-address') as HTMLInputElement).value).toBe(sampleAddressStr);
      expect((screen.getByTestId('input-amount') as HTMLInputElement).value).toBe('5.0');
      expect((screen.getByTestId('input-comment') as HTMLInputElement).value).toBe('Draft to preserve');
    });
  });
});
