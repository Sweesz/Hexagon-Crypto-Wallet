import { describe, it, expect, vi } from 'vitest';
import { Address } from '@ton/core';
import { TonClient } from '@ton/ton';
import { getWalletBalance, getBalance } from '../src/wallet/getBalance';

describe('getWalletBalance', () => {
    const validAddressObj = new Address(
        0,
        Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex')
    );
    const rawAddressStr = validAddressObj.toRawString();
    const friendlyAddressStr = validAddressObj.toString({
        urlSafe: true,
        bounceable: false,
        testOnly: true,
    });

    it('successfully fetches balance using mock TonClient and returns bigint', async () => {
        const expectedBalance = 5000000000n; // 5 TON
        const getBalanceMock = vi.fn().mockResolvedValue(expectedBalance);
        const mockClient = {
            getBalance: getBalanceMock,
        } as unknown as TonClient;

        const balance = await getWalletBalance(rawAddressStr, { client: mockClient });

        expect(balance).toBe(expectedBalance);
        expect(typeof balance).toBe('bigint');
        expect(getBalanceMock).toHaveBeenCalledTimes(1);
        const calledArg = getBalanceMock.mock.calls[0][0] as Address;
        expect(calledArg.equals(validAddressObj)).toBe(true);
    });

    it('works with friendly address format and Address instance', async () => {
        const getBalanceMock = vi.fn().mockResolvedValue(100000000n);
        const mockClient = {
            getBalance: getBalanceMock,
        } as unknown as TonClient;

        // Friendly string
        const balanceFriendly = await getWalletBalance(friendlyAddressStr, { client: mockClient });
        expect(balanceFriendly).toBe(100000000n);
        expect((getBalanceMock.mock.calls[0][0] as Address).equals(validAddressObj)).toBe(true);

        // Address object instance
        const balanceInstance = await getWalletBalance(validAddressObj, { client: mockClient });
        expect(balanceInstance).toBe(100000000n);
        expect((getBalanceMock.mock.calls[1][0] as Address).equals(validAddressObj)).toBe(true);
    });

    it('getBalance alias works identically', async () => {
        const mockClient = {
            getBalance: vi.fn().mockResolvedValue(2000000000n),
        } as unknown as TonClient;

        const balance = await getBalance(rawAddressStr, { client: mockClient });
        expect(balance).toBe(2000000000n);
    });

    it('handles string endpoint parameter as second argument', async () => {
        const mockClient = {
            getBalance: vi.fn().mockResolvedValue(0n),
        } as unknown as TonClient;

        const balance = await getWalletBalance(rawAddressStr, {
            client: mockClient,
            endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        });
        expect(balance).toBe(0n);
    });

    it('throws descriptive error on invalid address format', async () => {
        await expect(getWalletBalance('invalid-address-string')).rejects.toThrow(
            /Invalid TON address/i
        );

        await expect(getWalletBalance('')).rejects.toThrow(
            /Invalid TON address/i
        );

        await expect(getWalletBalance(12345 as any)).rejects.toThrow(
            /Invalid TON address/i
        );
    });

    it('gracefully handles "address not found" and returns 0n', async () => {
        const mockClient = {
            getBalance: vi.fn().mockRejectedValue(new Error('Account not found in block')),
        } as unknown as TonClient;

        const balance = await getWalletBalance(rawAddressStr, { client: mockClient });
        expect(balance).toBe(0n);
    });

    it('gracefully handles 404 response and returns 0n', async () => {
        const notFoundError = new Error('Request failed with status code 404');
        (notFoundError as any).response = { status: 404 };

        const mockClient = {
            getBalance: vi.fn().mockRejectedValue(notFoundError),
        } as unknown as TonClient;

        const balance = await getWalletBalance(rawAddressStr, { client: mockClient });
        expect(balance).toBe(0n);
    });

    it('gracefully handles network errors with clear message', async () => {
        const mockClient = {
            getBalance: vi.fn().mockRejectedValue(new Error('Network timeout')),
        } as unknown as TonClient;

        await expect(getWalletBalance(rawAddressStr, { client: mockClient })).rejects.toThrow(
            /Failed to fetch balance: Network timeout/i
        );
    });
});
