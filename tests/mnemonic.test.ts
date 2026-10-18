
import { describe, it, expect } from 'vitest';
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';

describe('Mnemonic and key generation', () => {
  it('mnemonicNew returns exactly 24 words', async () => {
    const mnemonic = await mnemonicNew();

    expect(mnemonic).toHaveLength(24);
    expect(mnemonic.every((word) => word.length > 0)).toBe(true);
  });

  it('mnemonicToPrivateKey generates valid public and private keys', async () => {
    const mnemonic = await mnemonicNew();
    const keyPair = await mnemonicToPrivateKey(mnemonic);

    expect(keyPair.publicKey).toBeInstanceOf(Buffer);
    expect(keyPair.secretKey).toBeInstanceOf(Buffer);

    expect(keyPair.publicKey).toHaveLength(32);
    expect(keyPair.secretKey).toHaveLength(64);
  });

  it('same mnemonic generates the same keys', async () => {
    const mnemonic = await mnemonicNew();

    const first = await mnemonicToPrivateKey(mnemonic);
    const second = await mnemonicToPrivateKey(mnemonic);

    expect(first.publicKey.equals(second.publicKey)).toBe(true);
    expect(first.secretKey.equals(second.secretKey)).toBe(true);
  });
});
