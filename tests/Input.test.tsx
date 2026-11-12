// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../src/components/Input';

describe('Input Component', () => {
  it('renders input with label connected via id and htmlFor', () => {
    render(<Input label="Wallet Address" placeholder="EQ..." />);
    const label = screen.getByText('Wallet Address');
    const input = screen.getByPlaceholderText('EQ...');
    expect(label).toBeDefined();
    expect(input).toBeDefined();
    expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
  });

  it('renders helper text and references it in aria-describedby', () => {
    render(<Input label="Amount" helperText="Fee: ~0.005 TON" />);
    const helper = screen.getByTestId('input-helper-text');
    const input = screen.getByRole('textbox');
    expect(helper.textContent).toBe('Fee: ~0.005 TON');
    expect(input.getAttribute('aria-describedby')).toContain(helper.getAttribute('id')!);
  });

  it('handles error message, sets aria-invalid and references errorId', () => {
    render(<Input label="Amount" error="Insufficient balance" />);
    const input = screen.getByRole('textbox');
    const errorEl = screen.getByTestId('input-error-message');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.classList.contains('input-state-error')).toBe(true);
    expect(errorEl.textContent).toBe('Insufficient balance');
    expect(input.getAttribute('aria-describedby')).toContain(errorEl.getAttribute('id')!);
  });

  it('handles user typing and triggers onChange', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} placeholder="Type here" />);
    const input = screen.getByPlaceholderText('Type here') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Hello TON' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('renders left and right icons when provided', () => {
    render(
      <Input
        leftIcon={<span data-testid="search-icon">🔍</span>}
        rightIcon={<span data-testid="clear-icon">✖</span>}
      />
    );
    expect(screen.getByTestId('input-left-icon')).toBeDefined();
    expect(screen.getByTestId('input-right-icon')).toBeDefined();
  });

  it('disables input when disabled prop is true', () => {
    render(<Input disabled placeholder="Locked" />);
    const input = screen.getByPlaceholderText('Locked');
    expect(input.hasAttribute('disabled')).toBe(true);
  });

  it('is keyboard navigable and focusable', () => {
    render(<Input label="Recipient" />);
    const input = screen.getByRole('textbox');
    input.focus();
    expect(document.activeElement).toBe(input);
  });
});
