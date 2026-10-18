
import { describe, it, expect } from 'vitest';
import { Address } from '@ton/core';

describe('TON address validation', () => {
  const validAddress = new Address(
    0,
    Buffer.from(
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      'hex'
    )
  );

  it('accepts a valid raw TON address', () => {
    expect(() => Address.parse(validAddress.toRawString())).not.toThrow();
  });

  it('accepts a friendly TON address', () => {
    const friendlyAddress = validAddress.toString({
      urlSafe: true,
      bounceable: true,
    });

    expect(() => Address.parse(friendlyAddress)).not.toThrow();
  });

  it('accepts a valid address with a negative workchain', () => {
    const address = new Address(
      -1,
      Buffer.from('a'.repeat(64), 'hex')
    );

    expect(() => Address.parse(address.toRawString())).not.toThrow();
  });

  it('rejects an address that is too short', () => {
    expect(() => Address.parse('0:123')).toThrow();
  });

  it('rejects an address with invalid characters', () => {
    expect(() => Address.parse('0:' + 'z'.repeat(64))).toThrow();
  });

  it('rejects an empty string', () => {
    expect(() => Address.parse('')).toThrow();
  });
});
