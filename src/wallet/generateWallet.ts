import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import type { GeneratedWallet, WalletGenerationOptions } from './types';

export async function generateWallet({
    workchain = 0,
    network = 'testnet',
    bounceable = false,
    password,
}: WalletGenerationOptions = {}): Promise<GeneratedWallet> {
    const mnemonics = await mnemonicNew(24, password);
    const keyPair = await mnemonicToPrivateKey(mnemonics, password);

    const wallet = WalletContractV4.create({
        workchain,
        publicKey: keyPair.publicKey,
    });

    const address = wallet.address.toString({
        urlSafe: true,
        testOnly: network === 'testnet',
        bounceable,
    });

    return {
        address,
        rawAddress: wallet.address.toRawString(),
        addressObject: wallet.address,
        publicKey: keyPair.publicKey,
        secretKey: keyPair.secretKey,
        mnemonics,
        wallet,
    };
}
