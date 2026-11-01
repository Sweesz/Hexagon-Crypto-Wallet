import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Address, SendMode, toNano } from '@ton/core';
import { TonClient } from '@ton/ton';
import {
    sendTransaction,
    parseAmountToNano,
    parseReceiverAddress,
    parseMnemonics,
} from '../src/wallet/sendTransaction';
import type { SendTransactionParams, SendTransactionOptions } from '../src/wallet/types';

describe('sendTransaction unit tests', () => {
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

    function createMockClient(overrides?: {
        isContractDeployed?: any;
        getContractState?: any;
        getBalance?: any;
        getSeqno?: any;
        sendTransfer?: any;
    }) {
        const isContractDeployedMock = overrides?.isContractDeployed ?? vi.fn().mockResolvedValue(true);
        const getBalanceMock = overrides?.getBalance ?? vi.fn().mockResolvedValue(10000000000n); // 10 TON
        const getSeqnoMock = overrides?.getSeqno ?? vi.fn().mockResolvedValue(1);
        const sendTransferMock = overrides?.sendTransfer ?? vi.fn().mockResolvedValue(undefined);

        const mockOpenedContract = {
            getSeqno: getSeqnoMock,
            sendTransfer: sendTransferMock,
        };

        const mockClient = {
            isContractDeployed: isContractDeployedMock,
            getBalance: getBalanceMock,
            open: vi.fn().mockReturnValue(mockOpenedContract),
            ...(overrides?.getContractState ? { getContractState: overrides.getContractState } : {}),
        } as unknown as TonClient;

        return {
            mockClient,
            isContractDeployedMock,
            getBalanceMock,
            getSeqnoMock,
            sendTransferMock,
            mockOpenedContract,
        };
    }

    describe('AC 4: Signatures & Argument Handling', () => {
        it('successfully executes with positional arguments', async () => {
            const { mockClient, sendTransferMock, getSeqnoMock } = createMockClient();
            const amount = 1000000000n; // 1 TON

            const result = await sendTransaction(
                mockMnemonics,
                mockAddressStr,
                amount,
                { client: mockClient }
            );

            expect(getSeqnoMock).toHaveBeenCalledTimes(1);
            expect(sendTransferMock).toHaveBeenCalledTimes(1);
            expect(result).toHaveProperty('hash');
            expect(result).toHaveProperty('boc');
            expect(result.seqno).toBe(1);
            expect(typeof result.hash).toBe('string');
            expect(result.hash.length).toBe(64);
            expect(typeof result.boc).toBe('string');
        });

        it('successfully executes with parameters object', async () => {
            const { mockClient, sendTransferMock, getSeqnoMock } = createMockClient({
                getSeqno: vi.fn().mockResolvedValue(5),
            });

            const params: SendTransactionParams = {
                senderMnemonics: mockMnemonics,
                receiverAddress: mockAddressObj,
                amount: '2.5',
                comment: 'Invoice #1042',
                bounceable: true,
            };

            const result = await sendTransaction(params, { client: mockClient });

            expect(getSeqnoMock).toHaveBeenCalledTimes(1);
            expect(sendTransferMock).toHaveBeenCalledTimes(1);
            expect(result.seqno).toBe(5);
            expect(result.hash).toBeTruthy();
            expect(result.boc).toBeTruthy();
        });
    });

    describe('Tasks 1-4 & 6: On-chain interaction, message construction & return value', () => {
        it('Task 1: Fetches seqno and passes it to sendTransfer', async () => {
            const { mockClient, sendTransferMock } = createMockClient({
                getSeqno: vi.fn().mockResolvedValue(42),
            });

            const result = await sendTransaction(
                mockMnemonics,
                mockAddressStr,
                1000000000n,
                { client: mockClient }
            );

            expect(result.seqno).toBe(42);
            expect(sendTransferMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    seqno: 42,
                    secretKey: expect.any(Buffer),
                    messages: expect.any(Array),
                })
            );
        });

        it('Task 2 & 4: Correctly builds internal message with comment, bounce flag, and amount', async () => {
            const { mockClient, sendTransferMock } = createMockClient();

            await sendTransaction(
                {
                    senderMnemonics: mockMnemonics,
                    receiverAddress: mockAddressStr,
                    amount: '3.14',
                    comment: 'Test comment memo',
                    bounceable: true,
                },
                { client: mockClient }
            );

            const callArgs = sendTransferMock.mock.calls[0][0];
            expect(callArgs.messages).toHaveLength(1);
            const internalMsg = callArgs.messages[0];
            expect(internalMsg.info.type).toBe('internal');
            expect(internalMsg.info.value.coins).toBe(toNano('3.14'));
            expect(internalMsg.info.bounce).toBe(true);
            expect(callArgs.sendMode).toBe(SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS);
        });

        it('Task 3: Derives 64-byte secretKey from mnemonics', async () => {
            const { mockClient, sendTransferMock } = createMockClient();

            await sendTransaction(
                mockMnemonics,
                mockAddressStr,
                1000000000n,
                { client: mockClient }
            );

            const callArgs = sendTransferMock.mock.calls[0][0];
            expect(Buffer.isBuffer(callArgs.secretKey)).toBe(true);
            expect(callArgs.secretKey.length).toBe(64);
        });

        it('Task 6: Returns 64-char hex transaction hash and base64 BOC upon success', async () => {
            const { mockClient } = createMockClient();

            const result = await sendTransaction(
                mockMnemonics,
                mockAddressStr,
                '1 TON',
                { client: mockClient }
            );

            expect(typeof result.hash).toBe('string');
            expect(result.hash).toMatch(/^[0-9a-fA-F]{64}$/);
            expect(typeof result.boc).toBe('string');
            expect(result.boc.length).toBeGreaterThan(50);
        });
    });

    describe('Task 5 & AC 3: Error Recovery & Descriptive Messages', () => {
        it('throws descriptive "Contract not deployed" error when sender wallet is undeployed', async () => {
            const { mockClient } = createMockClient({
                isContractDeployed: vi.fn().mockResolvedValue(false),
            });

            await expect(
                sendTransaction(mockMnemonics, mockAddressStr, 1000000000n, { client: mockClient })
            ).rejects.toThrow(/Contract not deployed/i);
        });

        it('throws descriptive "Contract not deployed" error when contract state is uninitialized', async () => {
            const mockClient = {
                getContractState: vi.fn().mockResolvedValue({ state: 'uninitialized' }),
                getBalance: vi.fn().mockResolvedValue(1000000000n),
                open: vi.fn(),
            } as unknown as TonClient;

            await expect(
                sendTransaction(mockMnemonics, mockAddressStr, 1000000000n, { client: mockClient })
            ).rejects.toThrow(/Contract not deployed/i);
        });

        it('throws descriptive "Insufficient funds" error when sender balance is less than amount', async () => {
            const { mockClient } = createMockClient({
                getBalance: vi.fn().mockResolvedValue(500000000n), // 0.5 TON balance
            });

            // Trying to send 1 TON with only 0.5 TON balance
            await expect(
                sendTransaction(mockMnemonics, mockAddressStr, 1000000000n, { client: mockClient })
            ).rejects.toThrow(/Insufficient funds/i);
        });

        it('throws descriptive "Insufficient funds" error if RPC fails with exit_code 37 during sendTransfer', async () => {
            const { mockClient } = createMockClient({
                sendTransfer: vi.fn().mockRejectedValue(new Error('LiteServer response error: exit_code: 37')),
            });

            await expect(
                sendTransaction(mockMnemonics, mockAddressStr, 1000000000n, { client: mockClient })
            ).rejects.toThrow(/Insufficient funds/i);
        });

        it('throws descriptive "Bad seqno" error when sequence number cannot be retrieved or is invalid', async () => {
            const { mockClient } = createMockClient({
                getSeqno: vi.fn().mockRejectedValue(new Error('Cannot compute seqno method')),
            });

            await expect(
                sendTransaction(mockMnemonics, mockAddressStr, 1000000000n, { client: mockClient })
            ).rejects.toThrow(/Bad seqno/i);
        });

        it('throws descriptive "Bad seqno" error when seqno is negative or NaN', async () => {
            const { mockClient } = createMockClient({
                getSeqno: vi.fn().mockResolvedValue(-1),
            });

            await expect(
                sendTransaction(mockMnemonics, mockAddressStr, 1000000000n, { client: mockClient })
            ).rejects.toThrow(/Bad seqno/i);
        });

        it('throws descriptive "Bad seqno" error if RPC fails with exit code 33 during sendTransfer', async () => {
            const { mockClient } = createMockClient({
                sendTransfer: vi.fn().mockRejectedValue(new Error('exit_code: 33 invalid seqno')),
            });

            await expect(
                sendTransaction(mockMnemonics, mockAddressStr, 1000000000n, { client: mockClient })
            ).rejects.toThrow(/Bad seqno/i);
        });

        it('throws descriptive "Network error" when node connection fails', async () => {
            const { mockClient } = createMockClient({
                isContractDeployed: vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND testnet.toncenter.com')),
            });

            await expect(
                sendTransaction(mockMnemonics, mockAddressStr, 1000000000n, { client: mockClient })
            ).rejects.toThrow(/Network error/i);
        });

        it('throws descriptive "Rate limit exceeded" error on HTTP 429', async () => {
            const { mockClient } = createMockClient({
                sendTransfer: vi.fn().mockRejectedValue(new Error('Request failed with status code 429: too many requests')),
            });

            await expect(
                sendTransaction(mockMnemonics, mockAddressStr, 1000000000n, { client: mockClient })
            ).rejects.toThrow(/Rate limit exceeded/i);
        });
    });

    describe('Input Validations', () => {
        it('throws on invalid receiver address format', async () => {
            const { mockClient } = createMockClient();

            await expect(
                sendTransaction(mockMnemonics, 'invalid-ton-address', 1000000000n, { client: mockClient })
            ).rejects.toThrow(/Invalid TON address/i);

            await expect(
                sendTransaction(mockMnemonics, '', 1000000000n, { client: mockClient })
            ).rejects.toThrow(/Invalid TON address/i);
        });

        it('throws on invalid mnemonics', async () => {
            const { mockClient } = createMockClient();

            await expect(
                sendTransaction([], mockAddressStr, 1000000000n, { client: mockClient })
            ).rejects.toThrow(/Invalid mnemonic/i);

            await expect(
                sendTransaction(null as any, mockAddressStr, 1000000000n, { client: mockClient })
            ).rejects.toThrow(/Invalid mnemonic/i);
        });

        it('throws on invalid or non-positive amounts', async () => {
            const { mockClient } = createMockClient();

            await expect(
                sendTransaction(mockMnemonics, mockAddressStr, 0n, { client: mockClient })
            ).rejects.toThrow(/Invalid amount/i);

            await expect(
                sendTransaction(mockMnemonics, mockAddressStr, -5, { client: mockClient })
            ).rejects.toThrow(/Invalid amount/i);

            await expect(
                sendTransaction(mockMnemonics, mockAddressStr, 'not-a-number', { client: mockClient })
            ).rejects.toThrow(/Invalid amount/i);
        });
    });

    describe('AC 1 & AC 2: Confirmation Polling & Seqno Increments', () => {
        it('polls for seqno increment when waitForConfirmation is enabled', async () => {
            let callCount = 0;
            const getSeqnoMock = vi.fn().mockImplementation(async () => {
                callCount++;
                // Returns 1 initially, then 2 on subsequent poll
                return callCount > 1 ? 2 : 1;
            });

            const { mockClient } = createMockClient({
                getSeqno: getSeqnoMock,
            });

            const result = await sendTransaction(
                mockMnemonics,
                mockAddressStr,
                1000000000n,
                {
                    client: mockClient,
                    waitForConfirmation: true,
                    pollingIntervalMs: 10,
                    maxWaitTimeoutMs: 1000,
                }
            );

            expect(result.seqno).toBe(1);
            expect(callCount).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Helper functions: parseAmountToNano, parseReceiverAddress, parseMnemonics', () => {
        it('parses various valid amount representations', () => {
            expect(parseAmountToNano(1000000000n)).toBe(1000000000n);
            expect(parseAmountToNano(1)).toBe(1000000000n);
            expect(parseAmountToNano('0.5')).toBe(500000000n);
            expect(parseAmountToNano('2.5 TON')).toBe(2500000000n);
            expect(parseAmountToNano('100 ton')).toBe(100000000000n);
        });

        it('parses valid receiver addresses', () => {
            const parsed = parseReceiverAddress(mockAddressStr);
            expect(parsed.equals(mockAddressObj)).toBe(true);

            const directInstance = parseReceiverAddress(mockAddressObj);
            expect(directInstance.equals(mockAddressObj)).toBe(true);
        });

        it('validates mnemonics', () => {
            expect(parseMnemonics(mockMnemonics)).toEqual(mockMnemonics);
            expect(() => parseMnemonics(['apple', ''])).toThrow(/Invalid mnemonic/i);
        });
    });
});
