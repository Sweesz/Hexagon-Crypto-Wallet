import { TonClient, WalletContractV4 } from '@ton/ton';
import { Address } from '@ton/core';

export interface WalletGenerationOptions {
    workchain?: number;      // по умолчанию 0
    network?: 'testnet' | 'mainnet'; // по умолчанию 'testnet'
    bounceable?: boolean;    // по умолчанию false
    password?: string;       // опциональный пароль к мнемонике
}

export interface GeneratedWallet {
    address: string;               // Testnet friendly-строка (kQ... / 0Q...)
    rawAddress?: string;           // 0:abcdef...
    addressObject: Address;        // Экземпляр Address из @ton/core
    publicKey: Buffer;             // 32-байтный буфер
    secretKey: Buffer;             // 64-байтный буфер
    mnemonics: string[];           // Массив из 24 слов
    wallet: WalletContractV4;      // Экземпляр контракта кошелька V4R2
}

export interface GetBalanceOptions {
    endpoint?: string;
    apiKey?: string;
    client?: TonClient;
}

