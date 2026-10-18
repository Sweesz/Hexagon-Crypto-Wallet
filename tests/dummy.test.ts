import { describe, it, expect } from 'vitest';

describe ('Enviroment Check', () => {
    it('should pass a simple math test', () => {
        expect(1+1).toBe(2);
    });

    it('should recognize TON network type', () => {
        const network = 'testnet';
        expect(network).toBe('testnet');
    });
});