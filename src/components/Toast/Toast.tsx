import React, { useState } from 'react';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id?: string;
  type?: ToastType;
  title?: string;
  message: React.ReactNode;
  technicalDetails?: string;
  duration?: number;
  onDismiss?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  id,
  type = 'info',
  title,
  message,
  technicalDetails,
  duration,
  onDismiss,
  className = '',
}) => {
  const [showDetails, setShowDetails] = useState<boolean>(false);

  const getRole = () => {
    return type === 'error' || type === 'warning' ? 'alert' : 'status';
  };

  const renderIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="toast-icon toast-icon-success" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="toast-icon toast-icon-warning" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="toast-icon toast-icon-error" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="toast-icon toast-icon-info" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const toastClasses = [
    'toast-item',
    `toast-${type}`,
    'wallet-toast',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={toastClasses}
      role={getRole()}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      data-testid="wallet-toast"
      data-toast-id={id}
      data-toast-type={type}
    >
      <div className="toast-main">
        <div className="toast-icon-wrapper">{renderIcon()}</div>
        <div className="toast-body">
          {title && <div className="toast-title">{title}</div>}
          <div className="toast-message" data-testid="toast-message">
            {message}
          </div>

          {technicalDetails && (
            <div className="toast-details-container">
              <button
                type="button"
                className="toast-details-toggle"
                data-testid="toast-details-toggle"
                onClick={() => setShowDetails((prev) => !prev)}
                aria-expanded={showDetails}
              >
                {showDetails ? 'Hide technical details' : 'Show technical details'}
              </button>
              {showDetails && (
                <pre className="toast-technical-details" data-testid="toast-technical-details">
                  {technicalDetails}
                </pre>
              )}
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            className="toast-close-btn"
            data-testid="toast-dismiss-btn"
            onClick={onDismiss}
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        )}
      </div>

      {duration && duration > 0 && (
        <div className="toast-progress-track" aria-hidden="true" data-testid="toast-progress-bar">
          <div
            className={`toast-progress-bar toast-progress-${type}`}
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      )}
    </div>
  );
};

export default Toast;
