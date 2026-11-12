// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Modal } from '../src/components/Modal';

describe('Modal Component', () => {
  it('does not render dialog when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        Modal Content
      </Modal>
    );
    expect(screen.queryByTestId('modal-dialog')).toBeNull();
  });

  it('renders modal dialog when isOpen is true with a11y attributes', () => {
    render(
      <Modal
        isOpen={true}
        onClose={() => {}}
        title="Confirm Transaction"
        description="Please review before sending"
      >
        <p>Sending 5 TON</p>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const title = screen.getByText('Confirm Transaction');
    const desc = screen.getByText('Please review before sending');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.getAttribute('id'));
    expect(dialog.getAttribute('aria-describedby')).toBe(desc.getAttribute('id'));
    expect(screen.getByText('Sending 5 TON')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        Content
      </Modal>
    );

    fireEvent.click(screen.getByTestId('modal-close-button'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking backdrop overlay', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        Content
      </Modal>
    );

    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when pressing Escape key', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        Content
      </Modal>
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('implements focus trap: Tab cycles between focusable elements', async () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Trap Test">
        <button data-testid="first-btn">First</button>
        <button data-testid="second-btn">Second</button>
      </Modal>
    );

    // Initial focus moves inside modal
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const closeBtn = screen.getByTestId('modal-close-button');
    const firstBtn = screen.getByTestId('first-btn');
    const secondBtn = screen.getByTestId('second-btn');

    // Focus on secondBtn (last focusable element) and press Tab -> should wrap to closeBtn (first focusable)
    secondBtn.focus();
    expect(document.activeElement).toBe(secondBtn);

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(closeBtn);

    // Focus on closeBtn (first focusable) and press Shift+Tab -> should wrap to secondBtn (last focusable)
    closeBtn.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(secondBtn);
  });
});
