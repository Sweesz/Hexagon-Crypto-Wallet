import { beforeAll, describe, expect, it } from 'vitest';
import { internal, toNano } from '@ton/core';
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4, TonClient } from '@ton/ton';
import { Blockchain } from '@ton/sandbox';
import { sendTransaction } from '../src/wallet/sendTransaction';

describe('sendTransaction — TON Sandbox integration', () => {
    let blockchain: Blockchain;
    let treasury: Awaited<ReturnType<Blockchain['treasury']>>;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        treasury = await blockchain.treasury('sandbox-funder');
    });

    async function createDeployedSender(initialBalance = '10') {
        const mnemonics = await mnemonicNew(24);
        const keyPair = await mnemonicToPrivateKey(mnemonics);

        const contract = WalletContractV4.create({
            workchain: 0,
            publicKey: keyPair.publicKey
        });

        const wallet = blockchain.openContract(contract);

        await treasury.send({
            to: contract.address,
            value: toNano(initialBalance),
            init: contract.init
        });

        const account = await blockchain.getContract(contract.address);

        expect(account.accountState?.type).toBe('active');

        return { mnemonics, contract, wallet };
    }

        type SandboxWallet = Awaited<
            ReturnType<typeof createDeployedSender>
        >['wallet'];

    function makeSandboxClient(
        contract: WalletContractV4,
        wallet: SandboxWallet,
        overrides: {
            seqno?: number;
            corruptSignature?: boolean;
        } = {},
    ): TonClient {
        const account = () => blockchain.getContract(contract.address);
        return {
            isContractDeployed: async () =>
                (await account()).accountState?.type === 'active',

            getBalance: async () => 
                (await account()).balance,
            open: () => ({
                getSeqno: async () => overrides.seqno ?? wallet.getSeqno(),
                sendTransfer: async ( args: Parameters<SandboxWallet['sendTransfer']>[0]) => {
                    if (!overrides.corruptSignature) {
                        return wallet.sendTransfer(args);
                    }
                    const invalidSecretKey = Buffer.from(args.secretKey);
                    invalidSecretKey[0] ^= 0xff;
                    return wallet.sendTransfer({ ...args, secretKey: invalidSecretKey });
                },
            }),
        } as unknown as TonClient;
    }

    it('sends TON between two wallets and updates the recipient balance', async () => {
        const sender = await createDeployedSender('10');
        const recipient = treasury.address;
        const before = (await blockchain.getContract(recipient)).balance;
        const client = makeSandboxClient(
            sender.contract,
            sender.wallet,
        );

        const result = await sendTransaction(sender.mnemonics, recipient, '1 TON', { client });

        const after = (await blockchain.getContract(recipient)).balance;
        expect(after - before).toBeGreaterThan(toNano('0.999'));
        expect(result.hash).toMatch(/^[0-9a-f]{64}$/i);
        expect(Buffer.from(result.boc, 'base64').length).toBeGreaterThan(0);
        expect(result.seqno).toBe(0);
    });

    it('rejects a stale/incorrect seqno in the TVM', async () => {
        const sender = await createDeployedSender('10');
        const client = makeSandboxClient(sender.contract, sender.wallet, { seqno: 99 });

        await expect(
            sendTransaction(sender.mnemonics, treasury.address, '1 TON', { client }),
        ).rejects.toThrow(/Bad seqno/i);
    });

    it('rejects a transfer when the sender cannot cover amount plus fees', async () => {

        const sender = await createDeployedSender('0.1');
        const client = makeSandboxClient(sender.contract, sender.wallet);

        await expect(
            sendTransaction(sender.mnemonics, treasury.address, '1 TON', { client }),
        ).rejects.toThrow(/Insufficient funds/i);
    });

    it('rejects a transfer signed with a corrupted secret key', async () => {
        const sender = await createDeployedSender('10');
        const client = makeSandboxClient(sender.contract, sender.wallet, {
            corruptSignature: true,
        });

        await expect(
            sendTransaction(sender.mnemonics, treasury.address, '1 TON', { client }),
        ).rejects.toThrow();
    });
});
