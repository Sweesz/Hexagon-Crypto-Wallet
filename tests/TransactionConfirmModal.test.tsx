// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Address } from '@ton/core';
import { TransactionConfirmModal } from '../src/components/TransactionConfirmModal';
import * as sendTransactionModule from '../src/wallet/sendTransaction';
import type { SendTransactionParams } from '../src/wallet/types';

describe('TransactionConfirmModal Component', () => {
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

  const defaultParams: SendTransactionParams = {
    senderMnemonics: sampleMnemonics,
    receiverAddress: sampleAddressStr,
    amount: '2.5',
    comment: 'Payment for lunch',
    bounceable: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Task 1: Reusable Component Rendering', () => {
    it('does not render when isOpen is false', () => {
      render(
        <TransactionConfirmModal
          isOpen={false}
          params={defaultParams}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.queryByTestId('transaction-confirm-modal')).toBeNull();
      expect(screen.queryByTestId('modal-backdrop')).toBeNull();
    });

    it('renders cleanly when isOpen is true with params object', () => {
      render(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByTestId('transaction-confirm-modal')).toBeDefined();
      expect(screen.getByTestId('modal-backdrop')).toBeDefined();
    });

    it('renders cleanly with individual props instead of params object', () => {
      render(
        <TransactionConfirmModal
          isOpen={true}
          receiverAddress={sampleAddressStr}
          amount="3.7"
          comment="Rent payment"
          estimatedFee="~0.008 TON"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByTestId('amount-display').textContent).toBe('3.7 TON');
      expect(screen.getByTestId('comment-display').textContent).toBe('Rent payment');
      expect(screen.getByTestId('fee-display').textContent).toBe('~0.008 TON');
    });
  });

  describe('Task 2 & AC 2: Display Critical Details Matching On-Chain Data', () => {
    it('displays receiver address in truncated format with full address accessible via title', () => {
      render(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const addressDisplay = screen.getByTestId('receiver-address-display');
      expect(addressDisplay.textContent).toContain('...');
      expect(addressDisplay.getAttribute('title')).toBe(sampleAddressStr);

      const start = sampleAddressStr.slice(0, 6);
      const end = sampleAddressStr.slice(-6);
      expect(addressDisplay.textContent).toBe(`${start}...${end}`);
    });

    it('displays Address instance correctly formatted and truncated', () => {
      render(
        <TransactionConfirmModal
          isOpen={true}
          receiverAddress={sampleAddressObj}
          amount={1000000000n} // 1 TON in nanoTons
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const addressDisplay = screen.getByTestId('receiver-address-display');
      expect(addressDisplay.textContent).toContain('...');
      expect(screen.getByTestId('amount-display').textContent).toBe('1 TON');
    });

    it('displays formatted amount in TON', () => {
      render(
        <TransactionConfirmModal
          isOpen={true}
          amount={5000000000n}
          receiverAddress={sampleAddressStr}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByTestId('amount-display').textContent).toBe('5 TON');
    });

    it('displays estimated fee correctly (custom or default)', () => {
      const { rerender } = render(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByTestId('fee-display').textContent).toBe('~0.005 TON');

      rerender(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          estimatedFee="0.012 TON"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByTestId('fee-display').textContent).toBe('0.012 TON');
    });

    it('displays comment if provided or "None" if empty', () => {
      const { rerender } = render(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByTestId('comment-display').textContent).toBe('Payment for lunch');

      rerender(
        <TransactionConfirmModal
          isOpen={true}
          receiverAddress={sampleAddressStr}
          amount="1"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByTestId('comment-display').textContent).toBe('None');
    });
  });

  describe('Task 3: Explicit "Confirm Send" and "Cancel" buttons', () => {
    it('renders both buttons with clear, accessible labels', () => {
      render(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const confirmBtn = screen.getByTestId('modal-confirm-btn');
      const cancelBtn = screen.getByTestId('modal-cancel-btn');

      expect(confirmBtn).toBeDefined();
      expect(cancelBtn).toBeDefined();
      expect(confirmBtn.textContent).toContain('Confirm Send');
      expect(cancelBtn.textContent).toContain('Cancel');
    });

    it('shows loading state on confirm button during transaction processing', () => {
      render(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          isLoading={true}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const confirmBtn = screen.getByTestId('modal-confirm-btn') as HTMLButtonElement;
      const cancelBtn = screen.getByTestId('modal-cancel-btn') as HTMLButtonElement;

      expect(confirmBtn.disabled).toBe(true);
      expect(cancelBtn.disabled).toBe(true);
      expect(confirmBtn.textContent).toContain('Sending...');
    });
  });

  describe('Task 4: Disable Backdrop Click to Prevent Accidental Dismissal', () => {
    it('does NOT dismiss modal when clicking on the backdrop overlay', () => {
      const onCancelMock = vi.fn();
      const onConfirmMock = vi.fn();

      render(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          onConfirm={onConfirmMock}
          onCancel={onCancelMock}
        />
      );

      const backdrop = screen.getByTestId('modal-backdrop');
      fireEvent.click(backdrop);

      // Crucial: Backdrop click must NOT trigger onCancel or onConfirm
      expect(onCancelMock).not.toHaveBeenCalled();
      expect(onConfirmMock).not.toHaveBeenCalled();
      expect(screen.getByTestId('transaction-confirm-modal')).toBeDefined();
    });
  });

  describe('Task 5 & AC 1 & AC 3: Safe Confirmation Flow & sendTransaction Execution', () => {
    it('AC 1: User cannot send funds without clicking "Confirm Send"', async () => {
      const sendTransactionSpy = vi.spyOn(sendTransactionModule, 'sendTransaction');
      const onConfirmMock = vi.fn();

      render(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          onConfirm={onConfirmMock}
          onCancel={vi.fn()}
        />
      );

      // Verify no transaction has been signed or sent upon opening modal
      expect(sendTransactionSpy).not.toHaveBeenCalled();
      expect(onConfirmMock).not.toHaveBeenCalled();
    });

    it('AC 3: Cancel button cleanly aborts the flow without side effects or sending funds', () => {
      const sendTransactionSpy = vi.spyOn(sendTransactionModule, 'sendTransaction');
      const onCancelMock = vi.fn();
      const onConfirmMock = vi.fn();

      render(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          onConfirm={onConfirmMock}
          onCancel={onCancelMock}
        />
      );

      const cancelBtn = screen.getByTestId('modal-cancel-btn');
      fireEvent.click(cancelBtn);

      expect(onCancelMock).toHaveBeenCalledTimes(1);
      expect(onConfirmMock).not.toHaveBeenCalled();
      expect(sendTransactionSpy).not.toHaveBeenCalled();
    });

    it('Task 5: Passes exact confirmed params to onConfirm / sendTransaction only after approval', async () => {
      const sendTransactionSpy = vi.spyOn(sendTransactionModule, 'sendTransaction').mockResolvedValue(undefined);

      const onConfirmMock = vi.fn(async (confirmedParams: SendTransactionParams) => {
        await sendTransactionModule.sendTransaction(confirmedParams);
      });

      render(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          onConfirm={onConfirmMock}
          onCancel={vi.fn()}
        />
      );

      const confirmBtn = screen.getByTestId('modal-confirm-btn');
      fireEvent.click(confirmBtn);

      expect(onConfirmMock).toHaveBeenCalledTimes(1);
      expect(onConfirmMock).toHaveBeenCalledWith(
        expect.objectContaining({
          senderMnemonics: defaultParams.senderMnemonics,
          receiverAddress: defaultParams.receiverAddress,
          amount: defaultParams.amount,
          comment: defaultParams.comment,
        })
      );

      expect(sendTransactionSpy).toHaveBeenCalledTimes(1);
      expect(sendTransactionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          senderMnemonics: defaultParams.senderMnemonics,
          receiverAddress: defaultParams.receiverAddress,
          amount: defaultParams.amount,
          comment: defaultParams.comment,
        })
      );
    });
  });

  describe('AC 4: Accessibility (WAI-ARIA & Keyboard Navigation)', () => {
    it('has proper ARIA modal dialog roles and accessibility labels', () => {
      render(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeDefined();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('confirm-modal-title');
      expect(dialog.getAttribute('aria-describedby')).toBe('confirm-modal-description');

      expect(screen.getByRole('heading', { name: /confirm transaction/i })).toBeDefined();
    });

    it('allows aborting via Escape key cleanly', () => {
      const onCancelMock = vi.fn();

      render(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          onConfirm={vi.fn()}
          onCancel={onCancelMock}
        />
      );

      const dialog = screen.getByTestId('transaction-confirm-modal');
      fireEvent.keyDown(dialog, { key: 'Escape' });

      expect(onCancelMock).toHaveBeenCalledTimes(1);
    });

    it('does not trigger Escape cancel when isLoading is true', () => {
      const onCancelMock = vi.fn();

      render(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          isLoading={true}
          onConfirm={vi.fn()}
          onCancel={onCancelMock}
        />
      );

      const dialog = screen.getByTestId('transaction-confirm-modal');
      fireEvent.keyDown(dialog, { key: 'Escape' });

      expect(onCancelMock).not.toHaveBeenCalled();
    });

    it('traps focus inside the modal on Tab and Shift+Tab', () => {
      render(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const cancelBtn = screen.getByTestId('modal-cancel-btn');
      const confirmBtn = screen.getByTestId('modal-confirm-btn');
      const dialog = screen.getByTestId('transaction-confirm-modal');

      // Focus last element (confirm button) and press Tab -> should wrap to first (cancel button)
      confirmBtn.focus();
      expect(document.activeElement).toBe(confirmBtn);

      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).toBe(cancelBtn);

      // Focus first element (cancel button) and press Shift+Tab -> should wrap to last (confirm button)
      cancelBtn.focus();
      expect(document.activeElement).toBe(cancelBtn);

      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(confirmBtn);
    });
  });

  describe('Error Message Banner', () => {
    it('displays error message when provided', () => {
      render(
        <TransactionConfirmModal
          isOpen={true}
          params={defaultParams}
          errorMessage="Insufficient balance to cover fee."
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const banner = screen.getByTestId('modal-error-message');
      expect(banner.textContent).toBe('Insufficient balance to cover fee.');
      expect(banner.getAttribute('role')).toBe('alert');
    });
  });
});
