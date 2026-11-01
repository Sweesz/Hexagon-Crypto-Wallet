import { describe, it, expect } from 'vitest';
import { Address } from '@ton/core';
import { truncateAddress, formatTonAmount, getFullAddressString } from '../src/utils/address';

describe('Address and Amount Utilities', () => {
  const sampleRaw = '0:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const sampleAddressObj = new Address(
    0,
    Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex')
  );
  const friendlyTestnet = sampleAddressObj.toString({ bounceable: false, urlSafe: true, testOnly: true });

  describe('truncateAddress', () => {
    it('returns empty string for null/undefined/empty input', () => {
      expect(truncateAddress('')).toBe('');
      expect(truncateAddress(null)).toBe('');
      expect(truncateAddress(undefined)).toBe('');
    });

    it('returns short string unchanged when length <= start + end', () => {
      expect(truncateAddress('12345', 4, 4)).toBe('12345');
    });

    it('truncates friendly address string correctly', () => {
      const truncated = truncateAddress(friendlyTestnet, 6, 6);
      expect(truncated.startsWith(friendlyTestnet.slice(0, 6))).toBe(true);
      expect(truncated.endsWith(friendlyTestnet.slice(-6))).toBe(true);
      expect(truncated).toContain('...');
    });

    it('truncates Address instance object', () => {
      const truncated = truncateAddress(sampleAddressObj, 6, 6);
      expect(truncated).toContain('...');
      expect(truncated.length).toBe(15); // 6 + 3 + 6 = 15
    });

    it('handles custom start and end lengths', () => {
      const truncated = truncateAddress(sampleRaw, 4, 4);
      expect(truncated).toBe('0:01...cdef');
    });
  });

  describe('formatTonAmount', () => {
    it('formats bigint nanoTons to TON string', () => {
      expect(formatTonAmount(1000000000n)).toBe('1 TON');
      expect(formatTonAmount(5500000000n)).toBe('5.5 TON');
      expect(formatTonAmount(0n)).toBe('0 TON');
    });

    it('formats numbers to TON string', () => {
      expect(formatTonAmount(5)).toBe('5 TON');
      expect(formatTonAmount(2.75)).toBe('2.75 TON');
      expect(formatTonAmount(0)).toBe('0 TON');
    });

    it('formats strings properly and does not duplicate TON suffix', () => {
      expect(formatTonAmount('10')).toBe('10 TON');
      expect(formatTonAmount('10 TON')).toBe('10 TON');
      expect(formatTonAmount('3.14 ton')).toBe('3.14 ton');
      expect(formatTonAmount('')).toBe('0 TON');
      expect(formatTonAmount(null)).toBe('0 TON');
    });
  });

  describe('getFullAddressString', () => {
    it('returns string unchanged', () => {
      expect(getFullAddressString(friendlyTestnet)).toBe(friendlyTestnet);
    });

    it('converts Address object to string', () => {
      expect(getFullAddressString(sampleAddressObj)).toBe(sampleAddressObj.toString({ bounceable: false, urlSafe: true }));
    });

    it('handles empty inputs', () => {
      expect(getFullAddressString(null)).toBe('');
      expect(getFullAddressString(undefined)).toBe('');
    });
  });
});
