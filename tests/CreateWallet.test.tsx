import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CreateWallet } from '../src/components/CreateWallet';

describe('CreateWallet component', () => {
    it('renders correctly', () => {
        const html = renderToString(<CreateWallet />);
        expect(html).toBeTruthy();
    });

    it('contains "Generate New Wallet" button', () => {
        const html = renderToString(<CreateWallet />);
        expect(html).toContain('Generate New Wallet');
    });

    it('contains textarea with mocked mnemonic phrase', () => {
        const html = renderToString(<CreateWallet />);
        expect(html).toContain('mnemonic-phrase');
        expect(html).toContain('apple banana cherry');
    });

    it('contains "Copy to Clipboard" button', () => {
        const html = renderToString(<CreateWallet />);
        expect(html).toContain('Copy to Clipboard');
    });
});
