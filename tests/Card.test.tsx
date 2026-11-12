// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../src/components/Card';

describe('Card Component', () => {
  it('renders default card with children', () => {
    render(<Card>Hello Card</Card>);
    const card = screen.getByText('Hello Card');
    expect(card).toBeDefined();
    expect(card.classList.contains('card-default')).toBe(true);
    expect(card.classList.contains('card-padding-md')).toBe(true);
  });

  it('renders structured subcomponents (Header, Title, Description, Content, Footer)', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Wallet Balance</CardTitle>
          <CardDescription>Main testnet account</CardDescription>
        </CardHeader>
        <CardContent>
          <span>100.5 TON</span>
        </CardContent>
        <CardFooter>
          <button>Send</button>
        </CardFooter>
      </Card>
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Wallet Balance' })).toBeDefined();
    expect(screen.getByText('Main testnet account')).toBeDefined();
    expect(screen.getByText('100.5 TON')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDefined();
  });

  it('renders specialized variants: balance, transaction, paper, dark', () => {
    const { rerender } = render(<Card variant="balance">Balance View</Card>);
    expect(screen.getByText('Balance View').classList.contains('card-balance')).toBe(true);

    rerender(<Card variant="transaction">Transaction Item</Card>);
    expect(screen.getByText('Transaction Item').classList.contains('card-transaction')).toBe(true);

    rerender(<Card variant="paper">Paper View</Card>);
    expect(screen.getByText('Paper View').classList.contains('card-paper')).toBe(true);

    rerender(<Card variant="dark">Dark View</Card>);
    expect(screen.getByText('Dark View').classList.contains('card-dark')).toBe(true);
  });

  it('renders interactive card with tabIndex and responds to click', () => {
    const handleClick = vi.fn();
    render(
      <Card interactive onClick={handleClick}>
        Interactive Card
      </Card>
    );
    const card = screen.getByText('Interactive Card');
    expect(card.classList.contains('card-interactive')).toBe(true);
    expect(card.getAttribute('tabindex')).toBe('0');

    card.focus();
    expect(document.activeElement).toBe(card);

    fireEvent.click(card);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
