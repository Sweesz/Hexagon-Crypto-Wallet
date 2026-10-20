import { Address } from '@ton/core';
import type { SendTransactionParams, SendTransactionOptions } from './types';

/**
 * Скелет функции отправки транзакции.
 * Поддерживает вызов как через объект параметров (SendTransactionParams),
 * так и позиционные аргументы (senderMnemonics, receiverAddress, amount).
 *
 * Полная имплементация отправки через TON SDK будет реализована в следующем спринте.
 */
export async function sendTransaction(
    params: SendTransactionParams,
    options?: SendTransactionOptions
): Promise<void>;
export async function sendTransaction(
    senderMnemonics: string[],
    receiverAddress: string | Address,
    amount: bigint | number | string,
    options?: SendTransactionOptions
): Promise<void>;
export async function sendTransaction(
    paramsOrMnemonics: SendTransactionParams | string[],
    receiverAddressOrOptions?: string | Address | SendTransactionOptions,
    amount?: bigint | number | string,
    options?: SendTransactionOptions
): Promise<void> {
    let params: SendTransactionParams;
    let effectiveOptions: SendTransactionOptions | undefined;

    if (Array.isArray(paramsOrMnemonics)) {
        params = {
            senderMnemonics: paramsOrMnemonics,
            receiverAddress: receiverAddressOrOptions as string | Address,
            amount: amount!,
        };
        effectiveOptions = options;
    } else {
        params = paramsOrMnemonics;
        effectiveOptions = receiverAddressOrOptions as SendTransactionOptions | undefined;
    }

    // Скелет: логирование аргументов транзакции
    console.log('Sending transaction:', {
        senderMnemonics: params.senderMnemonics,
        receiverAddress: params.receiverAddress,
        amount: params.amount,
        comment: params.comment,
        bounceable: params.bounceable,
        options: effectiveOptions,
    });
}
