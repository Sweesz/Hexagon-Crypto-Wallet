import React, { useState, useCallback, useId } from 'react';
import { Address } from '@ton/core';
import type { TonClient } from '@ton/ton';
import { validateTransactionInput } from '../utils/validateTransaction';
import { sendTransaction } from '../wallet/sendTransaction';
import type { SendTransactionParams, SendTransactionResult } from '../wallet/types';
import { useToast } from './Toast/ToastContext';
import { Button } from './Button/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card/Card';
import { TransactionConfirmModal } from './TransactionConfirmModal';
import { parseAppError } from '../utils/errorHandler';
import { truncateAddress } from '../utils/address';
import './SendTransaction.css';

/* Minimalist bespoke inline SVGs — zero emoji rule */
const AlertCircleIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
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
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const ExternalLinkIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={className}
    width="13"
    height="13"
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

const ShieldCheckIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const SendIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export const DEFAULT_DEMO_MNEMONICS = [
  'apple', 'banana', 'orange', 'grape', 'lemon', 'peach',
  'cherry', 'melon', 'mango', 'kiwi', 'plum', 'berry',
  'apricot', 'lime', 'fig', 'pear', 'coconut', 'papaya',
  'avocado', 'guava', 'date', 'olive', 'walnut', 'almond',
];

export interface SendTransactionProps {
  senderMnemonics?: string[];
  client?: TonClient;
  onSuccess?: (result: SendTransactionResult) => void;
  onError?: (error: unknown) => void;
  initialReceiver?: string;
  initialAmount?: string;
  initialComment?: string;
}

export const SendTransaction: React.FC<SendTransactionProps> = ({
  senderMnemonics,
  client,
  onSuccess,
  onError,
  initialReceiver = '',
  initialAmount = '',
  initialComment = '',
}) => {
  const toast = useToast();
  const addressInputId = useId();
  const amountInputId = useId();
  const commentInputId = useId();

  // Form inputs state
  const [receiverAddress, setReceiverAddress] = useState<string>(initialReceiver);
  const [amount, setAmount] = useState<string>(initialAmount);
  const [comment, setComment] = useState<string>(initialComment);

  // Field validation and touched states
  const [errors, setErrors] = useState<{
    receiverAddress?: string;
    amount?: string;
    comment?: string;
  }>({});
  const [touched, setTouched] = useState<{
    receiverAddress?: boolean;
    amount?: boolean;
    comment?: boolean;
  }>({});

  // Modal & sending states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);

  // Helper for byte length of comment
  const commentByteLength = new TextEncoder().encode(comment).length;

  /**
   * Validates a single field or all fields instantly.
   */
  const validateField = useCallback(
    (field: 'receiverAddress' | 'amount' | 'comment', value: string) => {
      const draft = {
        receiverAddress: field === 'receiverAddress' ? value : receiverAddress,
        amount: field === 'amount' ? value : amount,
        comment: field === 'comment' ? value : comment,
      };

      const result = validateTransactionInput(draft);

      setErrors((prev) => ({
        ...prev,
        [field]: result.errors[field],
      }));

      return result;
    },
    [receiverAddress, amount, comment]
  );

  // Input change handlers with instant validation
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setReceiverAddress(val);
    if (touched.receiverAddress || val.length > 5) {
      validateField('receiverAddress', val);
    }
  };

  const handleAddressBlur = () => {
    setTouched((prev) => ({ ...prev, receiverAddress: true }));
    validateField('receiverAddress', receiverAddress);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmount(val);
    if (touched.amount || val.length > 0) {
      validateField('amount', val);
    }
  };

  const handleAmountBlur = () => {
    setTouched((prev) => ({ ...prev, amount: true }));
    validateField('amount', amount);
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setComment(val);
    if (touched.comment || val.length > 0) {
      validateField('comment', val);
    }
  };

  const handleCommentBlur = () => {
    setTouched((prev) => ({ ...prev, comment: true }));
    validateField('comment', comment);
  };

  const handleQuickAmount = (tonVal: string) => {
    setAmount(tonVal);
    setTouched((prev) => ({ ...prev, amount: true }));
    validateField('amount', tonVal);
  };

  /**
   * "Review" button handler:
   * Validates all fields; if valid, opens Confirmation Modal with populated data.
   */
  const handleReview = () => {
    setTouched({
      receiverAddress: true,
      amount: true,
      comment: true,
    });

    const result = validateTransactionInput({
      receiverAddress,
      amount,
      comment: comment || undefined,
    });

    if (!result.isValid) {
      setErrors({
        receiverAddress: result.errors.receiverAddress,
        amount: result.errors.amount,
        comment: result.errors.comment,
      });
      return;
    }

    setErrors({});
    setIsModalOpen(true);
  };

  /**
   * "Confirm Send" handler inside Confirmation Modal:
   * Binds to sendTransaction(). Shows loading spinner in modal.
   * On success: shows success toast with tx hash link, resets form.
   * On error: shows error toast with actionable message, preserves draft.
   */
  const handleConfirmSend = async (confirmedParams: SendTransactionParams) => {
    setIsSending(true);

    try {
      // Use provided mnemonics or default demo mnemonics
      const effectiveMnemonics =
        senderMnemonics && senderMnemonics.length > 0
          ? senderMnemonics
          : confirmedParams.senderMnemonics && confirmedParams.senderMnemonics.length > 0
          ? confirmedParams.senderMnemonics
          : DEFAULT_DEMO_MNEMONICS;

      const txParams: SendTransactionParams = {
        senderMnemonics: effectiveMnemonics,
        receiverAddress: confirmedParams.receiverAddress,
        amount: confirmedParams.amount,
        comment: confirmedParams.comment,
        bounceable: confirmedParams.bounceable ?? false,
      };

      const result = await sendTransaction(txParams, { client });

      // Transaction succeeded
      setIsSending(false);
      setIsModalOpen(false);

      // Display success toast with tx hash link (matching design specs)
      const truncatedHash = truncateAddress(result.hash, 6, 6);
      const explorerUrl = `https://testnet.tonviewer.com/transaction/${result.hash}`;

      toast.showSuccess(
        <span className="toast-tx-success">
          Transaction broadcasted successfully!{' '}
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="toast-tx-link"
            data-testid="tx-hash-link"
          >
            Explorer: {truncatedHash} <ExternalLinkIcon />
          </a>
        </span>,
        {
          title: 'Transaction Sent',
          duration: 6000,
        }
      );

      // Reset form on success (Task requirement)
      setReceiverAddress('');
      setAmount('');
      setComment('');
      setErrors({});
      setTouched({});

      onSuccess?.(result);
    } catch (err: unknown) {
      // Transaction failed — keep modal closed or let user inspect, preserve draft
      setIsSending(false);
      setIsModalOpen(false);

      const parsed = parseAppError(err, 'Failed to send transaction');

      toast.showError(err, {
        title: 'Transaction Failed',
        message: parsed.userMessage,
        technicalDetails: parsed.technicalDetails,
      });

      // Draft is preserved — receiverAddress, amount, comment are NOT reset
      onError?.(err);
    }
  };

  return (
    <div className="send-container" data-testid="send-form-container">
      {/* Editorial Brutalist Tape / Ribbon Banner */}
      <div className="editorial-ribbon" role="banner" aria-label="Статус сети и отправка транзакций">
        <div className="editorial-ribbon-track">
          <span className="editorial-ribbon-segment">
            — ОТПРАВКА TON ✦ СЕТЬ TON TESTNET ✦ HEXAGON WALLET ✦ БЕЗОПАСНАЯ ПОДПИСЬ ✦&nbsp;
          </span>
          <span className="editorial-ribbon-segment" aria-hidden="true">
            — ОТПРАВКА TON ✦ СЕТЬ TON TESTNET ✦ HEXAGON WALLET ✦ БЕЗОПАСНАЯ ПОДПИСЬ ✦&nbsp;
          </span>
        </div>
      </div>

      <Card variant="paper" padding="lg" className="send-card">
        <CardHeader className="send-card-header">
          <div className="send-badge-row">
            <span className="send-badge">BROADCAST TX / TESTNET</span>
            <span className="send-badge-indicator">
              <span className="status-dot" /> СЕТЬ АКТИВНА
            </span>
          </div>
          <CardTitle as="h2" className="send-title text-display">
            SEND TON
          </CardTitle>
          <CardDescription className="send-description">
            Отправляйте монеты TON безопасно с предварительной проверкой параметров и подтверждением деталей транзакции.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Security & Validation Note */}
          <div className="sender-info-box" data-testid="security-note">
            <ShieldCheckIcon />
            <span>
              Перед отправкой все адреса и суммы валидируются на клиенте. Подпись транзакции
              происходит только после вашего явного подтверждения в окне проверки.
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleReview();
            }}
            noValidate
          >
            {/* Field 1: Receiver Address */}
            <div className="send-section">
              <div className="send-label-row">
                <label htmlFor={addressInputId} className="send-label">
                  Receiver Address <span className="input-required-mark" aria-hidden="true">*</span>
                </label>
                <span className="send-label-hint">TON Address (v4r2 / standard)</span>
              </div>
              <input
                id={addressInputId}
                type="text"
                className={`wallet-input text-mono ${errors.receiverAddress ? 'input-error' : ''}`}
                placeholder="Enter recipient TON address (e.g. 0Q... or EQ...)"
                value={receiverAddress}
                onChange={handleAddressChange}
                onBlur={handleAddressBlur}
                disabled={isSending}
                autoComplete="off"
                spellCheck="false"
                aria-invalid={Boolean(errors.receiverAddress)}
                aria-errormessage={errors.receiverAddress ? `${addressInputId}-error` : undefined}
                data-testid="input-receiver-address"
              />
              {errors.receiverAddress && (
                <p
                  id={`${addressInputId}-error`}
                  className="send-inline-error"
                  role="alert"
                  data-testid="error-receiver-address"
                >
                  <AlertCircleIcon /> {errors.receiverAddress}
                </p>
              )}
            </div>

            {/* Field 2: Amount in TON */}
            <div className="send-section">
              <div className="send-label-row">
                <label htmlFor={amountInputId} className="send-label">
                  Amount <span className="input-required-mark" aria-hidden="true">*</span>
                </label>
                <span className="send-label-hint">Min: &gt; 0 TON</span>
              </div>
              <div className="amount-input-wrapper">
                <input
                  id={amountInputId}
                  type="text"
                  className={`wallet-input text-mono ${errors.amount ? 'input-error' : ''}`}
                  placeholder="0.0"
                  value={amount}
                  onChange={handleAmountChange}
                  onBlur={handleAmountBlur}
                  disabled={isSending}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.amount)}
                  aria-errormessage={errors.amount ? `${amountInputId}-error` : undefined}
                  data-testid="input-amount"
                />
                <span className="amount-suffix-badge" aria-hidden="true">
                  TON
                </span>
              </div>

              {/* Quick Amount Selector Pills */}
              <div className="quick-amounts-row" aria-label="Быстрый выбор суммы">
                {['0.1', '0.5', '1', '5'].map((quickVal) => (
                  <button
                    key={quickVal}
                    type="button"
                    className="quick-amount-pill"
                    onClick={() => handleQuickAmount(quickVal)}
                    disabled={isSending}
                  >
                    +{quickVal} TON
                  </button>
                ))}
              </div>

              {errors.amount && (
                <p
                  id={`${amountInputId}-error`}
                  className="send-inline-error"
                  role="alert"
                  data-testid="error-amount"
                >
                  <AlertCircleIcon /> {errors.amount}
                </p>
              )}
            </div>

            {/* Field 3: Comment / Memo (Optional) */}
            <div className="send-section">
              <div className="send-label-row">
                <label htmlFor={commentInputId} className="send-label">
                  Comment / Memo <span className="send-label-hint">(Optional)</span>
                </label>
                <span
                  className={`comment-counter ${
                    commentByteLength >= 120
                      ? 'counter-error'
                      : commentByteLength > 100
                      ? 'counter-warning'
                      : ''
                  }`}
                  data-testid="comment-byte-counter"
                >
                  {commentByteLength}/120 bytes
                </span>
              </div>
              <input
                id={commentInputId}
                type="text"
                className={`wallet-input ${errors.comment ? 'input-error' : ''}`}
                placeholder="Enter payment memo or reference (< 120 bytes)"
                value={comment}
                onChange={handleCommentChange}
                onBlur={handleCommentBlur}
                disabled={isSending}
                maxLength={200}
                autoComplete="off"
                aria-invalid={Boolean(errors.comment)}
                aria-errormessage={errors.comment ? `${commentInputId}-error` : undefined}
                data-testid="input-comment"
              />
              {errors.comment && (
                <p
                  id={`${commentInputId}-error`}
                  className="send-inline-error"
                  role="alert"
                  data-testid="error-comment"
                >
                  <AlertCircleIcon /> {errors.comment}
                </p>
              )}
            </div>

            {/* Review Button */}
            <div className="send-section">
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleReview}
                disabled={isSending}
                className="btn-review-main"
                data-testid="btn-review"
              >
                <SendIcon /> Review
              </Button>
            </div>
          </form>
        </CardContent>

        <CardFooter className="wallet-card-footer send-card-footer">
          <span className="footer-note">
            HEXAGON PROTOCOL ✦ TESTNET ZERO-KNOWLEDGE SIGNING ✦ CLIENT VALIDATION
          </span>
        </CardFooter>
      </Card>

      {/* Confirmation Modal */}
      <TransactionConfirmModal
        isOpen={isModalOpen}
        receiverAddress={receiverAddress}
        amount={amount}
        comment={comment || undefined}
        estimatedFee="~0.005 TON"
        isLoading={isSending}
        onConfirm={handleConfirmSend}
        onCancel={() => {
          if (!isSending) {
            setIsModalOpen(false);
          }
        }}
      />
    </div>
  );
};

export default SendTransaction;
