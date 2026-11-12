import React, { useEffect, useRef, useId, useCallback } from 'react';
import './Modal.css';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  ariaLabel?: string;
  className?: string;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnEscape = true,
  closeOnOverlayClick = true,
  showCloseButton = true,
  ariaLabel,
  className = '',
}) => {
  const generatedId = useId();
  const titleId = title ? `modal-title-${generatedId}` : undefined;
  const descriptionId = description ? `modal-desc-${generatedId}` : undefined;

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Focus trap keyboard handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        if (!dialogRef.current) return;

        const focusableElements = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );

        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (
            document.activeElement === firstElement ||
            document.activeElement === dialogRef.current
          ) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [isOpen, closeOnEscape, onClose]
  );

  // Manage open / close effects (focus management and scroll lock)
  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element to restore later
    if (document.activeElement instanceof HTMLElement) {
      previousActiveElementRef.current = document.activeElement;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus initial element inside modal
    const focusTimer = setTimeout(() => {
      if (dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        } else {
          dialogRef.current.focus();
        }
      }
    }, 10);

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);

      // Restore focus
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const dialogClasses = [
    'modal-atomic-dialog',
    `modal-${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="modal-atomic-backdrop"
      onClick={handleBackdropClick}
      data-testid="modal-backdrop"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (!title ? 'Modal Dialog' : undefined)}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={dialogClasses}
        data-testid="modal-dialog"
      >
        {(title || showCloseButton) && (
          <div className="modal-atomic-header">
            <div className="modal-atomic-titles">
              {title && (
                <h2 id={titleId} className="modal-atomic-title">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="modal-atomic-description">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                className="modal-atomic-close-btn"
                onClick={onClose}
                aria-label="Close modal"
                data-testid="modal-close-button"
              >
                &times;
              </button>
            )}
          </div>
        )}

        <div className="modal-atomic-body">{children}</div>

        {footer && <div className="modal-atomic-footer">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
