import { TonClient } from '@ton/ton';
import { Address } from '@ton/core';
import type { GetBalanceOptions } from './types';
import { withRetry } from '../utils/retry';
import { isTransientNetworkError } from '../utils/errorHandler';

const TESTNET_ENDPOINT = 'https://testnet.toncenter.com/api/v2/jsonRPC';

/**
 * Checks if error indicates that account is uninitialized or not found in the blockchain.
 */
function isAccountNotFound(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
    const anyErr = error as any;
    return (
        message.includes('not found') ||
        message.includes('cannot find') ||
        message.includes('account not found') ||
        anyErr?.response?.status === 404
    );
}

/**
 * Получает баланс TON-адреса из Testnet в нанотонах (nano-tons).
 * Включает механизм автоматического повтора (retry) при временных сбоях сети (макс. 3 попытки).
 *
 * @param walletAddress Строка адреса (friendly или raw) или экземпляр Address
 * @param options Опции подключения или строковый URL эндпоинта
 * @returns Баланс в виде bigint
 */
export async function getWalletBalance(
    walletAddress: string | Address,
    options?: string | GetBalanceOptions
): Promise<bigint> {
    // 1. Валидация и парсинг входного адреса
    let parsedAddress: Address;
    try {
        if (typeof walletAddress === 'string') {
            parsedAddress = Address.parse(walletAddress.trim());
        } else if (walletAddress instanceof Address) {
            parsedAddress = walletAddress;
        } else {
            throw new Error('Address must be a string or Address instance');
        }
    } catch (error) {
        throw new Error(
            `Invalid TON address: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    // 2. Инициализация TonClient
    const opts: GetBalanceOptions =
        typeof options === 'string' ? { endpoint: options } : (options ?? {});

    const client =
        opts.client ??
        new TonClient({
            endpoint: opts.endpoint ?? TESTNET_ENDPOINT,
            apiKey: opts.apiKey,
        });

    // 3. Получение баланса с механизмом retry для транзиентных сетевых сбоев
    try {
        const balance = await withRetry(
            async () => {
                try {
                    return await client.getBalance(parsedAddress);
                } catch (err: unknown) {
                    if (isAccountNotFound(err)) {
                        return 0n;
                    }
                    throw err;
                }
            },
            {
                maxAttempts: 3,
                isTransient: (err) => !isAccountNotFound(err) && isTransientNetworkError(err),
            }
        );
        return balance;
    } catch (error: any) {
        if (isAccountNotFound(error)) {
            return 0n;
        }

        // Сетевые ошибки или сбои API
        throw new Error(
            `Failed to fetch balance: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

// Экспорт алиаса под именем getBalance
export const getBalance = getWalletBalance;
