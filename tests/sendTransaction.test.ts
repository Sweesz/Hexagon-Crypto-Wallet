import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Address } from '@ton/core';
import { sendTransaction } from '../src/wallet/sendTransaction';
import type { SendTransactionParams } from '../src/wallet/types';

describe('sendTransaction', () => {
    let consoleLogSpy: any;

    const mockMnemonics = [
        'apple', 'banana', 'orange', 'grape', 'lemon', 'peach',
        'cherry', 'melon', 'mango', 'kiwi', 'plum', 'berry',
        'apricot', 'lime', 'fig', 'pear', 'coconut', 'papaya',
        'avocado', 'guava', 'date', 'olive', 'walnut', 'almond',
    ];

    const mockAddressObj = new Address(
        0,
        Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex')
    );
    const mockAddressStr = mockAddressObj.toString({
        urlSafe: true,
        bounceable: false,
        testOnly: true,
    });

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    it('successfully accepts positional arguments and logs them', async () => {
        const amount = 1000000000n; // 1 TON in nanoton

        await sendTransaction(mockMnemonics, mockAddressStr, amount);

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Sending transaction:',
            expect.objectContaining({
                senderMnemonics: mockMnemonics,
                receiverAddress: mockAddressStr,
                amount: amount,
            })
        );
    });

    it('successfully accepts parameters object and logs all fields', async () => {
        const params: SendTransactionParams = {
            senderMnemonics: mockMnemonics,
            receiverAddress: mockAddressObj,
            amount: '5.5',
            comment: 'Payment for services',
            bounceable: true,
        };

        await sendTransaction(params);

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Sending transaction:',
            expect.objectContaining({
                senderMnemonics: mockMnemonics,
                receiverAddress: mockAddressObj,
                amount: '5.5',
                comment: 'Payment for services',
                bounceable: true,
            })
        );
    });

    it('accepts options with positional arguments', async () => {
        const options = { endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC' };

        await sendTransaction(mockMnemonics, mockAddressStr, 500, options);

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Sending transaction:',
            expect.objectContaining({
                senderMnemonics: mockMnemonics,
                receiverAddress: mockAddressStr,
                amount: 500,
                options,
            })
        );
    });

    it('returns a Promise resolving to void', async () => {
        const result = sendTransaction(mockMnemonics, mockAddressStr, 100n);
        expect(result).toBeInstanceOf(Promise);
        await expect(result).resolves.toBeUndefined();
    });
});
