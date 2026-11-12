import React, { forwardRef, useId } from 'react';
import './Input.css';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: React.ReactNode;
  error?: string | boolean;
  errorMessage?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      errorMessage,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = true,
      containerClassName = '',
      className = '',
      id,
      disabled = false,
      readOnly = false,
      required = false,
      type = 'text',
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || `input-${generatedId}`;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    // Resolve error string vs boolean
    const activeErrorText = typeof error === 'string' ? error : errorMessage;
    const hasError = Boolean(error || errorMessage);
    const errorId = hasError && activeErrorText ? `${inputId}-error` : undefined;

    // Combine aria-describedby references
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    const containerClasses = [
      'input-field-container',
      fullWidth ? 'input-full-width' : '',
      hasError ? 'has-error' : '',
      disabled ? 'is-disabled' : '',
      readOnly ? 'is-readonly' : '',
      containerClassName,
    ]
      .filter(Boolean)
      .join(' ');

    const inputClasses = [
      'input-atomic',
      leftIcon ? 'has-left-icon' : '',
      rightIcon ? 'has-right-icon' : '',
      hasError ? 'input-state-error' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={containerClasses} data-testid="input-field-container">
        {label && (
          <label htmlFor={inputId} className="input-label" data-testid="input-label">
            {label}
            {required && <span className="input-required-mark" aria-hidden="true"> *</span>}
          </label>
        )}

        <div className="input-wrapper">
          {leftIcon && (
            <span className="input-icon input-icon-left" aria-hidden="true" data-testid="input-left-icon">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            aria-invalid={hasError}
            aria-describedby={describedBy}
            aria-errormessage={errorId}
            className={inputClasses}
            {...rest}
          />

          {rightIcon && (
            <span className="input-icon input-icon-right" aria-hidden="true" data-testid="input-right-icon">
              {rightIcon}
            </span>
          )}
        </div>

        {hasError && activeErrorText && (
          <p id={errorId} className="input-error-message" role="alert" data-testid="input-error-message">
            {activeErrorText}
          </p>
        )}

        {!hasError && helperText && (
          <p id={helperId} className="input-helper-text" data-testid="input-helper-text">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
