import { beforeAll, describe, expect, it } from 'vitest';
import { Address } from '@ton/core';
import { mnemonicToPrivateKey, mnemonicValidate } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { generateWallet } from '../src/wallet/generateWallet';
import type { GeneratedWallet } from '../src/wallet/types';

describe('TON V4R2 wallet generation', () => {
  let generated: GeneratedWallet;

  beforeAll(async () => {
    generated = await generateWallet();
  }, 60_000);

  it('returns the required wallet fields and usable SDK objects', () => {
    expect(typeof generated.address).toBe('string');
    expect(generated.publicKey).toBeInstanceOf(Buffer);
    expect(generated.publicKey).toHaveLength(32);
    expect(generated.secretKey).toBeInstanceOf(Buffer);
    expect(generated.secretKey).toHaveLength(64);
    expect(generated.addressObject).toBeInstanceOf(Address);
    expect(generated.wallet).toBeInstanceOf(WalletContractV4);
    expect(generated.wallet.publicKey.equals(generated.publicKey)).toBe(true);
    expect(generated.wallet.address.equals(generated.addressObject)).toBe(true);
    expect(generated.rawAddress).toBe(generated.addressObject.toRawString());
  });

  it('returns a valid 24-word TON mnemonic', async () => {
    expect(generated.mnemonics).toHaveLength(24);
    expect(generated.mnemonics.every((word) => /^[a-z]+$/.test(word))).toBe(true);
    expect(await mnemonicValidate(generated.mnemonics)).toBe(true);
  }, 60_000);

  it('restores the returned keys and V4R2 address from the mnemonic', async () => {
    const restoredKeys = await mnemonicToPrivateKey(generated.mnemonics);
    const restoredWallet = WalletContractV4.create({
      workchain: 0,
      publicKey: restoredKeys.publicKey,
    });

    expect(restoredKeys.publicKey.equals(generated.publicKey)).toBe(true);
    expect(restoredKeys.secretKey.equals(generated.secretKey)).toBe(true);
    expect(restoredWallet.address.equals(Address.parse(generated.address))).toBe(true);
    expect(restoredWallet.address.toRawString()).toBe(generated.rawAddress);
  }, 60_000);

  it('defaults to a non-bounceable URL-safe Testnet address in workchain 0', () => {
    const parsed = Address.parseFriendly(generated.address);

    expect(generated.address).toMatch(/^0Q[A-Za-z0-9_-]{46}$/);
    expect(parsed.isTestOnly).toBe(true);
    expect(parsed.isBounceable).toBe(false);
    expect(parsed.address.workChain).toBe(0);
    expect(parsed.address.equals(generated.addressObject)).toBe(true);
  });

  it.each([
    { network: 'testnet' as const, bounceable: true, prefix: 'kQ', testOnly: true },
    { network: 'mainnet' as const, bounceable: false, prefix: 'UQ', testOnly: false },
    { network: 'mainnet' as const, bounceable: true, prefix: 'EQ', testOnly: false },
  ])('formats $network with bounceable=$bounceable', async ({
    network,
    bounceable,
    prefix,
    testOnly,
  }) => {
    const result = await generateWallet({ network, bounceable });
    const parsed = Address.parseFriendly(result.address);

    expect(result.address).toHaveLength(48);
    expect(result.address).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.address.startsWith(prefix)).toBe(true);
    expect(parsed.isTestOnly).toBe(testOnly);
    expect(parsed.isBounceable).toBe(bounceable);
    expect(parsed.address.workChain).toBe(0);
    expect(parsed.address.equals(result.wallet.address)).toBe(true);
    expect(parsed.address.toRawString()).toBe(result.rawAddress);
  }, 60_000);

  it('uses the requested workchain for the contract and returned addresses', async () => {
    const result = await generateWallet({ workchain: -1 });
    const parsed = Address.parseFriendly(result.address);
    const restoredWallet = WalletContractV4.create({
      workchain: -1,
      publicKey: result.publicKey,
    });

    expect(result.wallet.workchain).toBe(-1);
    expect(result.addressObject.workChain).toBe(-1);
    expect(parsed.address.workChain).toBe(-1);
    expect(parsed.isTestOnly).toBe(true);
    expect(parsed.isBounceable).toBe(false);
    expect(parsed.address.equals(restoredWallet.address)).toBe(true);
    expect(restoredWallet.address.toRawString()).toBe(result.rawAddress);
  }, 60_000);

  it('uses the same password for mnemonic generation and key derivation', async () => {
    const password = 'test-only-mnemonic-password';
    const result = await generateWallet({ password });
    const restoredKeys = await mnemonicToPrivateKey(result.mnemonics, password);
    const keysWithoutPassword = await mnemonicToPrivateKey(result.mnemonics);
    const restoredWallet = WalletContractV4.create({
      workchain: 0,
      publicKey: restoredKeys.publicKey,
    });

    expect(result.mnemonics).toHaveLength(24);
    expect(await mnemonicValidate(result.mnemonics, password)).toBe(true);
    expect(restoredKeys.publicKey.equals(result.publicKey)).toBe(true);
    expect(restoredKeys.secretKey.equals(result.secretKey)).toBe(true);
    expect(keysWithoutPassword.publicKey.equals(result.publicKey)).toBe(false);
    expect(restoredWallet.address.equals(Address.parse(result.address))).toBe(true);
  }, 60_000);

  it('generates a new mnemonic, key pair, and address on another call', async () => {
    const another = await generateWallet();

    expect(another.mnemonics).not.toEqual(generated.mnemonics);
    expect(another.publicKey.equals(generated.publicKey)).toBe(false);
    expect(another.secretKey.equals(generated.secretKey)).toBe(false);
    expect(another.addressObject.equals(generated.addressObject)).toBe(false);
  }, 60_000);
});
