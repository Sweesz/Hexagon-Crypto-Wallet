// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CheckBalance } from '../src/components/CheckBalance';

describe('CheckBalance component', () => {
    it('renders input field and check button', () => {
        render(<CheckBalance />);
        
        const input = screen.getByPlaceholderText('Enter TON address');
        const button = screen.getByRole('button', { name: /check balance/i });

        expect(input).toBeDefined();
        expect(button).toBeDefined();
    });

    it('allows user to type an address', () => {
        render(<CheckBalance />);
        
        const input = screen.getByPlaceholderText('Enter TON address') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'EQD4FPq-PRDieyQKkizFTRtNPnvHVCzN822yQNPXmvyOArLR' } });

        expect(input.value).toBe('EQD4FPq-PRDieyQKkizFTRtNPnvHVCzN822yQNPXmvyOArLR');
    });

    it('displays mocked balance "10 TON" upon clicking button', () => {
        render(<CheckBalance />);
        
        const input = screen.getByPlaceholderText('Enter TON address');
        const button = screen.getByRole('button', { name: /check balance/i });

        // Initially balance is not displayed
        expect(screen.queryByTestId('balance-display')).toBeNull();

        // Type address and click button
        fireEvent.change(input, { target: { value: 'EQD4FPq-PRDieyQKkizFTRtNPnvHVCzN822yQNPXmvyOArLR' } });
        fireEvent.click(button);

        // Verify balance is displayed
        const balanceDisplay = screen.getByTestId('balance-display');
        expect(balanceDisplay).toBeDefined();
        expect(balanceDisplay.textContent).toContain('10 TON');
    });
});
