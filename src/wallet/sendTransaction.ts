import { Address, SendMode, toNano, fromNano, internal, external, beginCell, storeMessage } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4, openContract } from '@ton/ton';
import type { SendTransactionParams, SendTransactionOptions, SendTransactionResult } from './types';

const DEFAULT_TESTNET_ENDPOINT = 'https://testnet.toncenter.com/api/v2/jsonRPC';

/**
 * Parses and validates the transaction amount into nanoTONs (bigint).
 */
export function parseAmountToNano(amount: bigint | number | string): bigint {
    if (amount === null || amount === undefined) {
        throw new Error('Invalid amount: amount is required');
    }

    let nano: bigint;
    if (typeof amount === 'bigint') {
        nano = amount;
    } else if (typeof amount === 'number') {
        if (!Number.isFinite(amount)) {
            throw new Error('Invalid amount: numeric value must be finite');
        }
        if (amount <= 0) {
            throw new Error('Invalid amount: must be greater than 0');
        }
        nano = toNano(amount.toString());
    } else if (typeof amount === 'string') {
        const trimmed = amount.trim();
        if (!trimmed) {
            throw new Error('Invalid amount: string cannot be empty');
        }
        const cleaned = trimmed.replace(/\s*ton$/i, '').trim();
        try {
            nano = toNano(cleaned);
        } catch (err: any) {
            throw new Error(`Invalid amount: cannot parse "${amount}" to nanoTON`);
        }
    } else {
        throw new Error('Invalid amount: must be bigint, number, or string');
    }

    if (nano <= 0n) {
        throw new Error('Invalid amount: must be greater than 0');
    }

    return nano;
}

/**
 * Validates and converts receiver address to an Address instance.
 */
export function parseReceiverAddress(address: string | Address | null | undefined): Address {
    if (!address) {
        throw new Error('Invalid TON address: receiver address is required');
    }
    if (address instanceof Address) {
        return address;
    }
    if (typeof address === 'string') {
        const trimmed = address.trim();
        if (!trimmed) {
            throw new Error('Invalid TON address: receiver address cannot be empty');
        }
        try {
            return Address.parse(trimmed);
        } catch (err: any) {
            throw new Error(`Invalid TON address: ${err?.message || String(err)}`);
        }
    }
    throw new Error('Invalid TON address: must be a valid string or Address instance');
}

/**
 * Validates mnemonic array.
 */
export function parseMnemonics(mnemonics: string[] | unknown): string[] {
    if (!mnemonics || !Array.isArray(mnemonics) || mnemonics.length === 0) {
        throw new Error('Invalid mnemonic: senderMnemonics must be a non-empty array of words');
    }
    for (let i = 0; i < mnemonics.length; i++) {
        if (typeof mnemonics[i] !== 'string' || !mnemonics[i].trim()) {
            throw new Error(`Invalid mnemonic: word at index ${i} is not a valid string`);
        }
    }
    return mnemonics;
}

/**
 * Formats error objects into clean, readable error strings without raw JSON.
 */
function formatErrorMessage(error: unknown): string {
    if (!error) return 'Unknown error';
    if (error instanceof Error) {
        try {
            const parsed = JSON.parse(error.message);
            if (parsed && typeof parsed === 'object') {
                return parsed.message || parsed.error || error.message;
            }
        } catch {
            // Not a JSON string
        }
        return error.message;
    }
    if (typeof error === 'object') {
        const anyErr = error as any;
        if (anyErr.message) return String(anyErr.message);
        if (anyErr.error) return String(anyErr.error);
    }
    return String(error);
}

/**
 * Sends a TON transfer on the blockchain with full seqno, signing, and error handling.
 * Supports both object parameters and positional arguments.
 *
 * @returns Transaction hash, BOC, and seqno upon success.
 */
export async function sendTransaction(
    params: SendTransactionParams,
    options?: SendTransactionOptions
): Promise<SendTransactionResult>;
export async function sendTransaction(
    senderMnemonics: string[],
    receiverAddress: string | Address,
    amount: bigint | number | string,
    options?: SendTransactionOptions
): Promise<SendTransactionResult>;
export async function sendTransaction(
    paramsOrMnemonics: SendTransactionParams | string[],
    receiverAddressOrOptions?: string | Address | SendTransactionOptions,
    amount?: bigint | number | string,
    options?: SendTransactionOptions
): Promise<SendTransactionResult> {
    // 1. Normalize parameters for dual signature support (AC 4)
    if (!paramsOrMnemonics) {
        throw new Error('Invalid mnemonic: senderMnemonics or parameters object is required');
    }

    let params: SendTransactionParams;
    let effectiveOptions: SendTransactionOptions | undefined;

    if (Array.isArray(paramsOrMnemonics)) {
        params = {
            senderMnemonics: paramsOrMnemonics,
            receiverAddress: receiverAddressOrOptions as string | Address,
            amount: amount!,
        };
        effectiveOptions = options;
    } else if (typeof paramsOrMnemonics === 'object') {
        params = paramsOrMnemonics;
        effectiveOptions = receiverAddressOrOptions as SendTransactionOptions | undefined;
    } else {
        throw new Error('Invalid mnemonic: senderMnemonics must be an array of words');
    }

    // 2. Validate input parameters
    const mnemonics = parseMnemonics(params?.senderMnemonics);
    const parsedReceiver = parseReceiverAddress(params?.receiverAddress);
    const amountNano = parseAmountToNano(params?.amount);

    // 3. Initialize TonClient
    const client = effectiveOptions?.client ?? new TonClient({
        endpoint: effectiveOptions?.endpoint ?? DEFAULT_TESTNET_ENDPOINT,
        apiKey: effectiveOptions?.apiKey,
    });

    // 4. Derive keypair from mnemonics (Task 3)
    let keyPair;
    try {
        keyPair = await mnemonicToPrivateKey(mnemonics, effectiveOptions?.password);
    } catch (err: any) {
        throw new Error(`Failed to derive keypair: ${formatErrorMessage(err)}`);
    }

    // 5. Create WalletContractV4 instance
    const walletContract = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey,
    });

    // 6. Verify sender wallet deployment status (Task 5 & AC 3: "contract not deployed")
    let isDeployed = true;
    try {
        if (typeof client.isContractDeployed === 'function') {
            isDeployed = await client.isContractDeployed(walletContract.address);
        } else if (typeof client.getContractState === 'function') {
            const state = await client.getContractState(walletContract.address);
            isDeployed = state?.state === 'active';
        }
    } catch (err: any) {
        const msg = String(err?.message || err).toLowerCase();
        if (
            msg.includes('not found') ||
            msg.includes('cannot find') ||
            msg.includes('account not found') ||
            err?.response?.status === 404
        ) {
            isDeployed = false;
        } else if (
            msg.includes('enotfound') ||
            msg.includes('fetch failed') ||
            msg.includes('econnrefused') ||
            msg.includes('etimedout')
        ) {
            throw new Error(`Network error: failed to communicate with TON node: ${err instanceof Error ? err.message : String(err)}`);
        } else {
            throw new Error(`Failed to check contract state: ${formatErrorMessage(err)}`);
        }
    }

    if (!isDeployed) {
        throw new Error(
            `Contract not deployed: sender wallet at ${walletContract.address.toString({
                testOnly: true,
                bounceable: false,
            })} is not deployed on the blockchain.`
        );
    }

    // 7. Verify balance (Task 5 & AC 3: "insufficient funds")
    if (typeof client.getBalance === 'function') {
        let balance: bigint;
        try {
            balance = await client.getBalance(walletContract.address);
        } catch (err: any) {
            const msg = String(err?.message || err).toLowerCase();
            if (
                msg.includes('enotfound') ||
                msg.includes('fetch failed') ||
                msg.includes('econnrefused') ||
                msg.includes('etimedout')
            ) {
                throw new Error(`Network error: failed to communicate with TON node: ${err instanceof Error ? err.message : String(err)}`);
            }
            throw new Error(`Failed to fetch wallet balance: ${formatErrorMessage(err)}`);
        }

        if (balance < amountNano) {
            throw new Error(
                `Insufficient funds: account balance (${fromNano(balance)} TON) is less than transfer amount (${fromNano(amountNano)} TON).`
            );
        }
    }

    // 8. Open contract and fetch current seqno (Task 1)
    const openedWallet = typeof client.open === 'function'
        ? client.open(walletContract)
        : openContract(walletContract, () => client.provider(walletContract.address, walletContract.init));

    let seqno: number;
    try {
        seqno = await openedWallet.getSeqno();
    } catch (err: any) {
        const msg = String(err?.message || err).toLowerCase();
        if (msg.includes('seqno') || msg.includes('sequence') || msg.includes('33')) {
            throw new Error(`Bad seqno: failed to retrieve valid sequence number.`);
        }
        if (
            msg.includes('enotfound') ||
            msg.includes('fetch failed') ||
            msg.includes('econnrefused') ||
            msg.includes('etimedout')
        ) {
            throw new Error(`Network error: failed to communicate with TON node: ${err instanceof Error ? err.message : String(err)}`);
        }
        throw new Error(`Failed to retrieve seqno: ${formatErrorMessage(err)}`);
    }

    if (typeof seqno !== 'number' || seqno < 0 || Number.isNaN(seqno)) {
        throw new Error(`Bad seqno: received invalid sequence number (${seqno}).`);
    }

    // 9. Build internal message (Task 2)
    const internalMsg = internal({
        to: parsedReceiver,
        value: amountNano,
        bounce: params.bounceable ?? false,
        body: params.comment ? params.comment : undefined,
    });

    const sendMode = effectiveOptions?.sendMode ?? (SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS);
    const timeout = effectiveOptions?.timeout ?? (Math.floor(Date.now() / 1000) + 60);

    // 10. Generate signed transfer Cell and external message for BOC & Hash (Task 6)
    const transferCell = walletContract.createTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [internalMsg],
        sendMode,
        timeout,
    });

    const extMsg = external({
        to: walletContract.address,
        init: isDeployed ? undefined : walletContract.init,
        body: transferCell,
    });
    const extCell = beginCell().store(storeMessage(extMsg)).endCell();
    const boc = extCell.toBoc().toString('base64');
    const hash = extCell.hash().toString('hex');

    // 11. Send transfer on-chain via walletContract.sendTransfer() (Task 4)
    try {
        await openedWallet.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            messages: [internalMsg],
            sendMode,
            timeout,
        });
    } catch (err: any) {
        const msg = String(err?.message || err).toLowerCase();

        if (msg.includes('bad seqno') || msg.includes('invalid seqno') || msg.includes('seqno') || msg.includes('exit_code: 33') || msg.includes('exit code 33')) {
            throw new Error('Bad seqno: sequence number is invalid or has already been used.');
        }

        if (
            msg.includes('insufficient') ||
            msg.includes('not enough balance') ||
            msg.includes('not enough funds') ||
            msg.includes('exit_code: 37') ||
            msg.includes('exit code 37') ||
            msg.includes('cannot pay')
        ) {
            throw new Error('Insufficient funds: sender does not have enough balance to cover amount and transaction fees.');
        }

        if (msg.includes('not deployed') || msg.includes('uninitialized') || msg.includes('account not found')) {
            throw new Error('Contract not deployed: sender wallet is not deployed on the blockchain.');
        }

        if (msg.includes('enotfound') || msg.includes('fetch failed') || msg.includes('econnrefused') || msg.includes('etimedout')) {
            throw new Error(`Network error: failed to communicate with TON node: ${err instanceof Error ? err.message : String(err)}`);
        }

        if (msg.includes('429') || msg.includes('too many requests')) {
            throw new Error('Rate limit exceeded: too many requests to TON RPC. Please try again later.');
        }

        throw new Error(`Failed to send transaction: ${formatErrorMessage(err)}`);
    }

    // 12. Optional confirmation polling (AC 1 & AC 2)
    if (effectiveOptions?.waitForConfirmation) {
        const pollingInterval = effectiveOptions.pollingIntervalMs ?? 1500;
        const maxWaitTimeout = effectiveOptions.maxWaitTimeoutMs ?? 60000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTimeout) {
            await new Promise((resolve) => setTimeout(resolve, pollingInterval));
            try {
                const currentSeqno = await openedWallet.getSeqno();
                if (currentSeqno > seqno) {
                    break;
                }
            } catch {
                // Ignore transient network errors while polling
            }
        }
    }

    // 13. Return transaction hash, BOC, and seqno upon success (Task 6)
    return {
        hash,
        boc,
        seqno,
    };
}
