// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../src/components/Button';

describe('Button Component', () => {
  it('renders default primary button with children', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeDefined();
    expect(button.classList.contains('btn-primary')).toBe(true);
    expect(button.classList.contains('btn-md')).toBe(true);
    expect(button.getAttribute('type')).toBe('button');
  });

  it('renders secondary and ghost variants', () => {
    const { rerender } = render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button').classList.contains('btn-secondary')).toBe(true);

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button').classList.contains('btn-ghost')).toBe(true);
  });

  it('renders different sizes (sm, md, lg)', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button').classList.contains('btn-sm')).toBe(true);

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button').classList.contains('btn-lg')).toBe(true);
  });

  it('handles click events when enabled', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Submit</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and prevents click events when disabled prop is true', () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    const button = screen.getByRole('button');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('shows loading spinner and disables interactions when isLoading is true', () => {
    const handleClick = vi.fn();
    render(<Button isLoading onClick={handleClick}>Saving</Button>);
    const button = screen.getByRole('button');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByTestId('btn-spinner')).toBeDefined();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders left and right icons when provided and not loading', () => {
    render(
      <Button
        leftIcon={<span data-testid="left-icon">Left</span>}
        rightIcon={<span data-testid="right-icon">Right</span>}
      >
        With Icons
      </Button>
    );
    expect(screen.getByTestId('left-icon')).toBeDefined();
    expect(screen.getByTestId('right-icon')).toBeDefined();
  });

  it('is keyboard navigable and triggers with keyboard', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Focus me</Button>);
    const button = screen.getByRole('button');
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalled();
  });
});
