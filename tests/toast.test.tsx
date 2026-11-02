// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../src/components/Toast';

const TestToastConsumer: React.FC = () => {
  const toast = useToast();

  return (
    <div>
      <button
        onClick={() => toast.showSuccess('Operation succeeded!')}
        data-testid="trigger-success"
      >
        Trigger Success
      </button>
      <button
        onClick={() =>
          toast.showError(new Error('Network connection failed'), {
            message: 'Unable to connect to network',
            technicalDetails: 'Error: Network connection failed\nCode: ECONNREFUSED',
          })
        }
        data-testid="trigger-error"
      >
        Trigger Error
      </button>
      <button
        onClick={() => toast.showWarning('Attention: Gas fees are high')}
        data-testid="trigger-warning"
      >
        Trigger Warning
      </button>
      <button onClick={() => toast.clearAllToasts()} data-testid="trigger-clear-all">
        Clear All
      </button>
    </div>
  );
};

describe('ToastProvider & useToast (Tasks 1 & 2 & Acceptance Criteria 2 & 3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders ToastProvider and renders success toast with auto-dismiss after 4 seconds (AC 3)', async () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    const successBtn = screen.getByTestId('trigger-success');
    fireEvent.click(successBtn);

    // Toast is immediately visible
    expect(screen.getByText('Operation succeeded!')).toBeDefined();
    const toastItem = screen.getByTestId('wallet-toast');
    expect(toastItem.getAttribute('data-toast-type')).toBe('success');

    // Advance 3.9 seconds: should still be visible
    act(() => {
      vi.advanceTimersByTime(3900);
    });
    expect(screen.queryByText('Operation succeeded!')).not.toBeNull();

    // Advance past 4 seconds (AC 3: 4000ms): should be auto-dismissed
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Operation succeeded!')).toBeNull();
  });

  it('renders warning toast variant correctly', () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('trigger-warning'));

    const toastItem = screen.getByTestId('wallet-toast');
    expect(toastItem.getAttribute('data-toast-type')).toBe('warning');
    expect(screen.getByText('Attention: Gas fees are high')).toBeDefined();
  });

  it('renders error toast with human-readable message and technical details toggle (AC 2)', () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('trigger-error'));

    // Human-readable message is shown
    expect(screen.getByText('Unable to connect to network')).toBeDefined();

    // Technical details are initially hidden behind toggle
    expect(screen.queryByTestId('toast-technical-details')).toBeNull();

    const toggleBtn = screen.getByTestId('toast-details-toggle');
    expect(toggleBtn.textContent).toContain('Show technical details');

    // Click toggle to reveal technical details
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('toast-technical-details')).toBeDefined();
    expect(screen.getByTestId('toast-technical-details').textContent).toContain('ECONNREFUSED');
    expect(toggleBtn.textContent).toContain('Hide technical details');

    // Click toggle again to hide
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId('toast-technical-details')).toBeNull();
  });

  it('allows manual dismissal via close button', () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('trigger-warning'));
    expect(screen.getByText('Attention: Gas fees are high')).toBeDefined();

    const closeBtn = screen.getByTestId('toast-dismiss-btn');
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Attention: Gas fees are high')).toBeNull();
  });

  it('clears all toasts when clearAllToasts is called', () => {
    render(
      <ToastProvider>
        <TestToastConsumer />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('trigger-success'));
    fireEvent.click(screen.getByTestId('trigger-warning'));
    expect(screen.getAllByTestId('wallet-toast').length).toBe(2);

    fireEvent.click(screen.getByTestId('trigger-clear-all'));
    expect(screen.queryByTestId('wallet-toast')).toBeNull();
  });
});
