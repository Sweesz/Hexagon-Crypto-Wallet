import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// localStorage polyfill for node env (no-op in jsdom/happy-dom)
// Must run BEFORE the first call into secureStorage.

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void { this.map.delete(key); }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}

import {
  encryptAndStoreWalletSecrets,
  decryptStoredWalletSecrets,
  withDecryptedWalletSecrets,
  removeEncryptedWallet,
  hasEncryptedWallet,
  ENCRYPTED_WALLET_STORAGE_KEY,
  type DecryptedWalletSecrets,
} from '../src/wallet/secureStorage';


// Fixtures

const PASSWORD = 'correct horse battery staple';
const WRONG_PASSWORD = 'wrong password';
const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PRIVATE_KEY = new Uint8Array([
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
]);

async function seedWallet(): Promise<void> {
  await encryptAndStoreWalletSecrets(PASSWORD, MNEMONIC, PRIVATE_KEY);
}

function readEnvelopeRaw(): any {
  const raw = localStorage.getItem(ENCRYPTED_WALLET_STORAGE_KEY);
  if (!raw) throw new Error('no envelope');
  return JSON.parse(atob(raw));
}

function writeEnvelopeRaw(envelope: any): void {
  localStorage.setItem(
    ENCRYPTED_WALLET_STORAGE_KEY,
    btoa(JSON.stringify(envelope)),
  );
}

function tamperBase64Field(
  env: any,
  field: 'salt' | 'iv' | 'ciphertext' | 'tag',
): void {
  const bytes = Uint8Array.from(atob(env[field]), (c) => c.charCodeAt(0));
  bytes[0] ^= 0xff;
  env[field] = btoa(String.fromCharCode(...bytes));
}


// Clean localStorage between tests (safe when it's undefined)

beforeEach(() => {
  globalThis.localStorage?.clear?.();
});
afterEach(() => {
  globalThis.localStorage?.clear?.();
});


// encryptAndStoreWalletSecrets

describe('encryptAndStoreWalletSecrets', () => {
  it('stores a valid base64 envelope in localStorage', async () => {
    await seedWallet();

    const raw = localStorage.getItem(ENCRYPTED_WALLET_STORAGE_KEY);
    expect(raw).toBeTruthy();

    const decoded = atob(raw!);
    expect(() => JSON.parse(decoded)).not.toThrow();

    const env = JSON.parse(decoded);
    expect(env.version).toBe(1);
    expect(env.kdf).toBe('PBKDF2-SHA-256');
    expect(env.iterations).toBe(210_000);
    expect(env.cipher).toBe('AES-256-GCM');
    expect(env.mac).toBe('HMAC-SHA-256');
    expect(typeof env.salt).toBe('string');
    expect(typeof env.iv).toBe('string');
    expect(typeof env.ciphertext).toBe('string');
    expect(typeof env.tag).toBe('string');

    expect(atob(env.salt).length).toBe(16);
    expect(atob(env.iv).length).toBe(12);
    expect(atob(env.tag).length).toBe(32);
  });

  it('uses fresh salt and iv on every call', async () => {
    await seedWallet();
    const first = readEnvelopeRaw();
    globalThis.localStorage?.clear?.();
    await seedWallet();
    const second = readEnvelopeRaw();

    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('overwrites an existing wallet', async () => {
    await seedWallet();
    const first = localStorage.getItem(ENCRYPTED_WALLET_STORAGE_KEY);

    await encryptAndStoreWalletSecrets(
      PASSWORD,
      'other mnemonic',
      new Uint8Array([9, 9, 9]),
    );
    const second = localStorage.getItem(ENCRYPTED_WALLET_STORAGE_KEY);

    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
  });

  it('throws on empty password', async () => {
    await expect(
      encryptAndStoreWalletSecrets('', MNEMONIC, PRIVATE_KEY),
    ).rejects.toThrow(/non-empty password/i);
  });

  it('throws on empty mnemonic', async () => {
    await expect(
      encryptAndStoreWalletSecrets(PASSWORD, '', PRIVATE_KEY),
    ).rejects.toThrow(/secrets are empty/i);
  });

  it('throws on empty private key', async () => {
    await expect(
      encryptAndStoreWalletSecrets(PASSWORD, MNEMONIC, new Uint8Array(0)),
    ).rejects.toThrow(/secrets are empty/i);
  });

  it('does not write to localStorage when validation fails', async () => {
    await expect(
      encryptAndStoreWalletSecrets('', MNEMONIC, PRIVATE_KEY),
    ).rejects.toThrow();
    expect(localStorage.getItem(ENCRYPTED_WALLET_STORAGE_KEY)).toBeNull();
  });
});


// decryptStoredWalletSecrets — happy path

describe('decryptStoredWalletSecrets — happy path', () => {
  it('returns the original mnemonic and privateKey', async () => {
    await seedWallet();
    const secrets = await decryptStoredWalletSecrets(PASSWORD);

    expect(secrets.mnemonic).toBe(MNEMONIC);
    expect(Array.from(secrets.privateKey)).toEqual(Array.from(PRIVATE_KEY));
  });

  it('handles multi-byte UTF-8 in the mnemonic', async () => {
    const mnemonic = 'hello world 你好 🌍';
    await encryptAndStoreWalletSecrets(PASSWORD, mnemonic, PRIVATE_KEY);
    const secrets = await decryptStoredWalletSecrets(PASSWORD);
    expect(secrets.mnemonic).toBe(mnemonic);
  });

  it('handles a large privateKey', async () => {
    const big = new Uint8Array(1024);
    for (let i = 0; i < big.length; i++) big[i] = i % 256;
    await encryptAndStoreWalletSecrets(PASSWORD, MNEMONIC, big);
    const secrets = await decryptStoredWalletSecrets(PASSWORD);
    expect(Array.from(secrets.privateKey)).toEqual(Array.from(big));
  });

  it('supports repeated encrypt→decrypt cycles', async () => {
    for (let i = 0; i < 3; i++) {
      const pk = new Uint8Array([i, i + 1, i + 2]);
      await encryptAndStoreWalletSecrets(PASSWORD, `mnemonic-${i}`, pk);
      const secrets = await decryptStoredWalletSecrets(PASSWORD);
      expect(secrets.mnemonic).toBe(`mnemonic-${i}`);
      expect(Array.from(secrets.privateKey)).toEqual(Array.from(pk));
    }
  });
});


// decryptStoredWalletSecrets — errors

describe('decryptStoredWalletSecrets — errors', () => {
  it('throws when no wallet is stored', async () => {
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /No encrypted wallet/i,
    );
  });

  it('throws on wrong password', async () => {
    await seedWallet();
    await expect(
      decryptStoredWalletSecrets(WRONG_PASSWORD),
    ).rejects.toThrow(/Incorrect password|modified/i);
  });

  it('throws on empty password after a wallet was stored', async () => {
    await seedWallet();
    await expect(decryptStoredWalletSecrets('')).rejects.toThrow(
      /non-empty password/i,
    );
  });

  it('throws on invalid base64 in the outer layer', async () => {
    localStorage.setItem(ENCRYPTED_WALLET_STORAGE_KEY, '!!!not-base64!!!');
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /invalid/i,
    );
  });

  it('throws on valid base64 but invalid JSON', async () => {
    localStorage.setItem(
      ENCRYPTED_WALLET_STORAGE_KEY,
      btoa('not json at all'),
    );
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /invalid/i,
    );
  });

  it('throws on unsupported version', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    env.version = 2;
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /Unsupported/i,
    );
  });

  it('throws on unsupported KDF', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    env.kdf = 'scrypt';
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /Unsupported/i,
    );
  });

  it('throws when iterations are downgraded', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    env.iterations = 1000;
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /Unsupported/i,
    );
  });

  it('throws on unsupported cipher', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    env.cipher = 'AES-128-CBC';
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /Unsupported/i,
    );
  });

  it('throws on unsupported MAC', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    env.mac = 'SHA-1';
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /Unsupported/i,
    );
  });

  it('throws when salt is tampered (HMAC)', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    tamperBase64Field(env, 'salt');
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /Incorrect password|modified/i,
    );
  });

  it('throws when iv is tampered (HMAC)', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    tamperBase64Field(env, 'iv');
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /Incorrect password|modified/i,
    );
  });

  it('throws when ciphertext is tampered (HMAC)', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    tamperBase64Field(env, 'ciphertext');
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /Incorrect password|modified/i,
    );
  });

  it('throws when tag is tampered', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    tamperBase64Field(env, 'tag');
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /Incorrect password|modified/i,
    );
  });

  it('throws on wrong salt length', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    env.salt = btoa('short');
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /invalid/i,
    );
  });

  it('throws on wrong iv length', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    env.iv = btoa('short');
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /invalid/i,
    );
  });

  it('throws on wrong tag length', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    env.tag = btoa('short');
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /invalid/i,
    );
  });

  it('does not leak which check failed (no oracle)', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    env.tag = btoa('x'.repeat(32));
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /Incorrect password or encrypted wallet data was modified/i,
    );
  });
});


// Regression: fromBase64 outside try (review bug)

describe('regression: broken base64 in salt/iv/tag is wrapped', () => {
  it('wraps broken base64 in salt into a friendly error', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    env.salt = '%%%%';
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /invalid|Incorrect/i,
    );
  });

  it('wraps broken base64 in iv into a friendly error', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    env.iv = '%%%%';
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /invalid|Incorrect/i,
    );
  });

  it('wraps broken base64 in tag into a friendly error', async () => {
    await seedWallet();
    const env = readEnvelopeRaw();
    env.tag = '%%%%';
    writeEnvelopeRaw(env);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /invalid|Incorrect/i,
    );
  });
});

// withDecryptedWalletSecrets

describe('withDecryptedWalletSecrets', () => {
  it('passes secrets to operation and returns its result', async () => {
    await seedWallet();

    const result = await withDecryptedWalletSecrets(
      PASSWORD,
      async (secrets: DecryptedWalletSecrets) => {
        expect(secrets.mnemonic).toBe(MNEMONIC);
        expect(Array.from(secrets.privateKey)).toEqual(Array.from(PRIVATE_KEY));
        return 'ok';
      },
    );

    expect(result).toBe('ok');
  });

  it('zeroes privateKey and clears mnemonic on success', async () => {
    await seedWallet();
    let captured: DecryptedWalletSecrets | undefined;

    await withDecryptedWalletSecrets(PASSWORD, async (secrets) => {
      captured = secrets;
      return null;
    });

    expect(captured).toBeDefined();
    expect(Array.from(captured!.privateKey)).toEqual(
      new Array(captured!.privateKey.length).fill(0),
    );
    expect(captured!.mnemonic).toBe('');
  });

  it('zeroes secrets even when operation throws', async () => {
    await seedWallet();
    let captured: DecryptedWalletSecrets | undefined;

    await expect(
      withDecryptedWalletSecrets(PASSWORD, async (secrets) => {
        captured = secrets;
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(captured).toBeDefined();
    expect(Array.from(captured!.privateKey)).toEqual(
      new Array(captured!.privateKey.length).fill(0),
    );
    expect(captured!.mnemonic).toBe('');
  });

  it('does not call operation on wrong password', async () => {
    await seedWallet();
    const op = vi.fn();
    await expect(
      withDecryptedWalletSecrets(WRONG_PASSWORD, op),
    ).rejects.toThrow();
    expect(op).not.toHaveBeenCalled();
  });
});


// remove / has

describe('removeEncryptedWallet / hasEncryptedWallet', () => {
  it('hasEncryptedWallet is false initially', () => {
    expect(hasEncryptedWallet()).toBe(false);
  });

  it('hasEncryptedWallet is true after saving', async () => {
    await seedWallet();
    expect(hasEncryptedWallet()).toBe(true);
  });

  it('removeEncryptedWallet deletes the wallet', async () => {
    await seedWallet();
    removeEncryptedWallet();
    expect(hasEncryptedWallet()).toBe(false);
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /No encrypted wallet/i,
    );
  });

  it('removeEncryptedWallet is idempotent', () => {
    expect(() => removeEncryptedWallet()).not.toThrow();
    expect(() => removeEncryptedWallet()).not.toThrow();
  });

  it('ENCRYPTED_WALLET_STORAGE_KEY matches the localStorage key', async () => {
    await seedWallet();
    expect(localStorage.getItem(ENCRYPTED_WALLET_STORAGE_KEY)).toBeTruthy();
  });
});

// Environment: no localStorage

describe('behavior without localStorage', () => {
  let saved: Storage | undefined;

  beforeEach(() => {
    saved = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: saved,
      configurable: true,
      writable: true,
    });
  });

  it('encryptAndStoreWalletSecrets throws', async () => {
    await expect(
      encryptAndStoreWalletSecrets(PASSWORD, MNEMONIC, PRIVATE_KEY),
    ).rejects.toThrow(/localStorage is unavailable/i);
  });

  it('decryptStoredWalletSecrets throws', async () => {
    await expect(decryptStoredWalletSecrets(PASSWORD)).rejects.toThrow(
      /localStorage is unavailable/i,
    );
  });

  it('hasEncryptedWallet returns false', () => {
    expect(hasEncryptedWallet()).toBe(false);
  });

  it('removeEncryptedWallet does not throw', () => {
    expect(() => removeEncryptedWallet()).not.toThrow();
  });
});