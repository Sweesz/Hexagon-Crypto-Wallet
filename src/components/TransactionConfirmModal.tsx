import React, { useEffect, useRef, useCallback } from 'react';
import { Address } from '@ton/core';
import type { SendTransactionParams } from '../wallet/types';
import { truncateAddress, formatTonAmount, getFullAddressString } from '../utils/address';
import './TransactionConfirmModal.css';

export interface TransactionConfirmModalProps {
  /**
   * Whether the modal is currently open and visible.
   */
  isOpen: boolean;

  /**
   * Complete transaction parameters (optional shorthand for receiverAddress, amount, comment, etc.)
   */
  params?: SendTransactionParams | null;

  /**
   * Destination address (string or @ton/core Address).
   */
  receiverAddress?: string | Address;

  /**
   * Transaction amount in TON or nanoTons.
   */
  amount?: bigint | number | string;

  /**
   * Estimated transaction network fee (defaults to '~0.005 TON').
   */
  estimatedFee?: string;

  /**
   * Optional transaction memo/comment.
   */
  comment?: string;

  /**
   * Whether bounceable flag is set for the destination address.
   */
  bounceable?: boolean;

  /**
   * Indicates if sending is in progress.
   */
  isLoading?: boolean;

  /**
   * Optional error message to display in the modal.
   */
  errorMessage?: string | null;

  /**
   * Callback invoked only when user explicitly clicks "Confirm Send".
   * Receives the normalized SendTransactionParams to be sent on-chain.
   */
  onConfirm: (confirmedParams: SendTransactionParams) => void | Promise<void>;

  /**
   * Callback invoked when user cancels the flow via "Cancel" button or Escape key.
   */
  onCancel: () => void;
}

export const TransactionConfirmModal: React.FC<TransactionConfirmModalProps> = ({
  isOpen,
  params,
  receiverAddress,
  amount,
  estimatedFee = '~0.005 TON',
  comment,
  bounceable,
  isLoading = false,
  errorMessage,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Derive effective parameters prioritizing explicit props over params object
  const effectiveReceiver = receiverAddress ?? params?.receiverAddress ?? '';
  const effectiveAmount = amount ?? params?.amount ?? '0';
  const effectiveComment = comment !== undefined ? comment : params?.comment;
  const effectiveBounceable = bounceable !== undefined ? bounceable : params?.bounceable;

  const fullReceiverString = getFullAddressString(effectiveReceiver);
  const truncatedReceiverString = truncateAddress(effectiveReceiver, 6, 6);
  const formattedAmount = formatTonAmount(effectiveAmount);

  // Construct the confirmed SendTransactionParams for downstream execution
  const confirmedParams: SendTransactionParams = {
    senderMnemonics: params?.senderMnemonics ?? [],
    receiverAddress: effectiveReceiver,
    amount: effectiveAmount,
    comment: effectiveComment,
    bounceable: effectiveBounceable,
  };

  const handleConfirm = useCallback(() => {
    if (isLoading) return;
    onConfirm(confirmedParams);
  }, [isLoading, onConfirm, confirmedParams]);

  // Trap focus and handle keyboard navigation (Escape to cancel, Tab cycling)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (!isLoading) {
          onCancel();
        }
        return;
      }

      if (e.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusableElements = dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [isOpen, isLoading, onCancel]
  );

  // Manage focus restoration on open/close
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      // Focus cancel button or dialog content
      const timer = setTimeout(() => {
        if (cancelButtonRef.current) {
          cancelButtonRef.current.focus();
        } else if (dialogRef.current) {
          dialogRef.current.focus();
        }
      }, 50);

      return () => clearTimeout(timer);
    } else {
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modal-backdrop"
      data-testid="modal-backdrop"
      /* Task 4: Disable modal backdrop click to prevent accidental dismissal */
      onClick={(e) => {
        // Prevent dismissal on clicking background
        e.stopPropagation();
      }}
      role="presentation"
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-description"
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        data-testid="transaction-confirm-modal"
      >
        <div className="modal-header">
          <div className="modal-icon-badge" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 id="confirm-modal-title" className="modal-title">
            Confirm Transaction
          </h2>
          <p id="confirm-modal-description" className="modal-subtitle">
            Please review the critical details below before signing and broadcasting.
          </p>
        </div>

        <div className="modal-details-card">
          {/* Receiver Address Row */}
          <div className="modal-detail-row">
            <span className="modal-detail-label">Receiver Address</span>
            <div className="modal-detail-value-wrapper">
              <span
                className="modal-detail-value modal-address-truncated"
                data-testid="receiver-address-display"
                title={fullReceiverString}
                aria-label={`Receiver address: ${fullReceiverString}`}
              >
                {truncatedReceiverString || '—'}
              </span>
              {fullReceiverString && (
                <span className="modal-address-full" data-testid="receiver-address-full" aria-hidden="true">
                  {fullReceiverString}
                </span>
              )}
            </div>
          </div>

          {/* Amount in TON Row */}
          <div className="modal-detail-row">
            <span className="modal-detail-label">Amount</span>
            <span
              className="modal-detail-value modal-amount-highlight"
              data-testid="amount-display"
              aria-label={`Amount to send: ${formattedAmount}`}
            >
              {formattedAmount}
            </span>
          </div>

          {/* Estimated Fee Row */}
          <div className="modal-detail-row">
            <span className="modal-detail-label">Estimated Fee</span>
            <span
              className="modal-detail-value"
              data-testid="fee-display"
              aria-label={`Estimated network fee: ${estimatedFee}`}
            >
              {estimatedFee}
            </span>
          </div>

          {/* Comment Row */}
          <div className="modal-detail-row">
            <span className="modal-detail-label">Comment</span>
            <span
              className="modal-detail-value modal-comment-value"
              data-testid="comment-display"
              aria-label={effectiveComment ? `Comment: ${effectiveComment}` : 'No comment attached'}
            >
              {effectiveComment ? effectiveComment : <span className="modal-empty-text">None</span>}
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="modal-error-banner" role="alert" data-testid="modal-error-message">
            {errorMessage}
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn-modal-cancel"
            ref={cancelButtonRef}
            onClick={onCancel}
            disabled={isLoading}
            data-testid="modal-cancel-btn"
            aria-label="Cancel transaction"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-modal-confirm"
            onClick={handleConfirm}
            disabled={isLoading}
            data-testid="modal-confirm-btn"
            aria-label="Confirm and send transaction"
          >
            {isLoading ? (
              <span className="btn-modal-loading">
                <span className="modal-spinner" aria-hidden="true" />
                Sending...
              </span>
            ) : (
              'Confirm Send'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionConfirmModal;
