// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast } from '../src/components/Toast';

describe('Standalone Atomic Toast Component', () => {
  it('renders standalone toast with success variant and auto-dismiss animation progress bar', () => {
    render(
      <Toast
        type="success"
        title="Transaction Sent"
        message="5 TON sent successfully"
        duration={4000}
      />
    );

    const toast = screen.getByTestId('wallet-toast');
    expect(toast.getAttribute('data-toast-type')).toBe('success');
    expect(screen.getByText('Transaction Sent')).toBeDefined();
    expect(screen.getByText('5 TON sent successfully')).toBeDefined();

    // Verify auto-dismiss animation progress bar is rendered
    const progressBar = screen.getByTestId('toast-progress-bar');
    expect(progressBar).toBeDefined();
  });

  it('renders error and warning variants with accessible ARIA alert role', () => {
    const { rerender } = render(
      <Toast type="error" message="Transaction rejected" />
    );
    expect(screen.getByRole('alert')).toBeDefined();

    rerender(<Toast type="warning" message="Gas is high" />);
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('triggers onDismiss when close button is clicked', () => {
    const handleDismiss = vi.fn();
    render(
      <Toast
        type="info"
        message="Notice"
        onDismiss={handleDismiss}
      />
    );

    const closeBtn = screen.getByTestId('toast-dismiss-btn');
    fireEvent.click(closeBtn);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
