import { TonClient } from '@ton/ton';
import { Address } from '@ton/core';
import type { GetBalanceOptions } from './types';

const TESTNET_ENDPOINT = 'https://testnet.toncenter.com/api/v2/jsonRPC';

/**
 * Получает баланс TON-адреса из Testnet в нанотонах (nano-tons).
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

    // 3. Получение баланса и обработка ошибок
    try {
        const balance = await client.getBalance(parsedAddress);
        return balance;
    } catch (error: any) {
        const message = error?.message?.toLowerCase() || '';

        // Обработка случая, когда адрес не найден / не инициализирован в блокчейне
        if (
            message.includes('not found') ||
            message.includes('cannot find') ||
            message.includes('account not found') ||
            error?.response?.status === 404
        ) {
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
