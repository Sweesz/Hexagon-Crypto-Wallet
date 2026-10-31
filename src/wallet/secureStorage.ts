const STORAGE_KEY = 'hexagon.encrypted-wallet.v1';
const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface EncryptedEnvelope {
  version: 1; 
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  cipher: 'AES-256-GCM';
  mac: 'HMAC-SHA-256';
  salt: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

export interface DecryptedWalletSecrets {
  mnemonic: string;
  privateKey: Uint8Array;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
    function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(arrays.reduce((n, item) => n + item.length, 0));
  let offset = 0;
  for (const item of arrays) {
    result.set(item, offset);
    offset += item.length;
  }
  return result;
}

async function deriveKeys(password: string, salt: Uint8Array) {
  if (!password) throw new Error('A non-empty password is required.');
  const material = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(encoder.encode(password)),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
      {
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: toArrayBuffer(salt),
    iterations: PBKDF2_ITERATIONS
  },
    material,
    512,
  ));
  try {
    const aesKey = await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']);
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      bits.slice(32, 64),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
    return { aesKey, hmacKey };
  } finally {
    bits.fill(0);
  }
}

function authenticatedData(envelope: Omit<EncryptedEnvelope, 'tag'>): Uint8Array {
  return encoder.encode([
    envelope.version,
    envelope.kdf,
    envelope.iterations,
    envelope.cipher,
    envelope.mac,
    envelope.salt,
    envelope.iv,
    envelope.ciphertext,
  ].join('.'));
}

export async function encryptAndStoreWalletSecrets(
  password: string,
  mnemonic: string,
  privateKey: Uint8Array,
): Promise<void> {
  if (typeof localStorage === 'undefined') throw new Error('localStorage is unavailable.');
  if (!mnemonic || privateKey.length === 0) throw new Error('Wallet secrets are empty.');

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const keys = await deriveKeys(password, salt);
  const plaintext = encoder.encode(JSON.stringify({
    mnemonic,
    privateKey: toBase64(privateKey),
  }));

  try {
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: toArrayBuffer(iv),
          tagLength: 128
        },
        keys.aesKey,
        toArrayBuffer(plaintext)
      )
    );
    const envelope: Omit<EncryptedEnvelope, 'tag'> = {
      version: 1,
      kdf: 'PBKDF2-SHA-256',
      iterations: PBKDF2_ITERATIONS,
      cipher: 'AES-256-GCM',
      mac: 'HMAC-SHA-256',
      salt: toBase64(salt),
      iv: toBase64(iv),
      ciphertext: toBase64(ciphertext),
    };
    const tag = new Uint8Array(
      await crypto.subtle.sign(
        'HMAC',
        keys.hmacKey,
        toArrayBuffer(authenticatedData(envelope))
      )
    );
    const serialized = encoder.encode(JSON.stringify({ ...envelope, tag: toBase64(tag) }));
    localStorage.setItem(STORAGE_KEY, toBase64(serialized));
    tag.fill(0);
    ciphertext.fill(0);
  } finally {
    plaintext.fill(0);
    salt.fill(0);
    iv.fill(0);
  }
}

export async function decryptStoredWalletSecrets(password: string): Promise<DecryptedWalletSecrets> {
  if (typeof localStorage === 'undefined') throw new Error('localStorage is unavailable.');
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) throw new Error('No encrypted wallet is stored.');

  let envelope: EncryptedEnvelope;
  try {
    envelope = JSON.parse(decoder.decode(fromBase64(stored))) as EncryptedEnvelope;
  } catch {
    throw new Error('Encrypted wallet data is invalid.');
  }
  if (
    envelope.version !== 1 ||
    envelope.kdf !== 'PBKDF2-SHA-256' ||
    envelope.iterations !== PBKDF2_ITERATIONS ||
    envelope.cipher !== 'AES-256-GCM' ||
    envelope.mac !== 'HMAC-SHA-256'
  ) throw new Error('Unsupported encrypted wallet format.');

  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  const ciphertext = fromBase64(envelope.ciphertext);
  const tag = fromBase64(envelope.tag);
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || tag.length !== 32) {
    throw new Error('Encrypted wallet data is invalid.');
  }

  const keys = await deriveKeys(password, salt);
  const { tag: _tag, ...unsignedEnvelope } = envelope;
  const valid = await crypto.subtle.verify(
    'HMAC',
    keys.hmacKey,
    toArrayBuffer(tag),
    toArrayBuffer(authenticatedData(unsignedEnvelope))
  );
  if (!valid) throw new Error('Incorrect password or encrypted wallet data was modified.');

  let plaintext: Uint8Array | undefined;
  try {
    plaintext = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',  
          iv: toArrayBuffer(iv),
          tagLength: 128
        },
        keys.aesKey,
        toArrayBuffer(ciphertext)
      )
    );
    const payload = JSON.parse(decoder.decode(plaintext)) as { mnemonic: string; privateKey: string };
    if (typeof payload.mnemonic !== 'string' || typeof payload.privateKey !== 'string') {
      throw new Error('Encrypted wallet payload is invalid.');
    }
    return { mnemonic: payload.mnemonic, privateKey: fromBase64(payload.privateKey) };
  } catch {
    throw new Error('Incorrect password or encrypted wallet data was modified.');
  } finally {
    plaintext?.fill(0);
    salt.fill(0);
    iv.fill(0);
    ciphertext.fill(0);
    tag.fill(0);
  }
}

export async function withDecryptedWalletSecrets<T>(
  password: string,
  operation: (secrets: DecryptedWalletSecrets) => Promise<T>,
): Promise<T> {
  const secrets = await decryptStoredWalletSecrets(password);
  try {
    return await operation(secrets);
  } finally {
    secrets.privateKey.fill(0);
    secrets.mnemonic = '';
  }
}

export function removeEncryptedWallet(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
}

export function hasEncryptedWallet(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) !== null;
}

export const ENCRYPTED_WALLET_STORAGE_KEY = STORAGE_KEY;
