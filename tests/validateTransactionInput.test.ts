import { describe, it, expect, vi } from 'vitest';
import { Address, toNano } from '@ton/core';
import {
  validateTransactionInput,
  TRANSACTION_VALIDATION_ERROR_KEYS,
  DEFAULT_TRANSACTION_VALIDATION_MESSAGES,
} from '../src/utils/validateTransaction';
import { sendTransaction } from '../src/wallet/sendTransaction';
import type { TonClient } from '@ton/ton';

describe('validateTransactionInput Unit Tests', () => {
  const validAddressObj = new Address(
    0,
    Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex')
  );
  const validAddressStr = validAddressObj.toString({
    urlSafe: true,
    bounceable: false,
    testOnly: true,
  });

  const validMnemonics = [
    'apple', 'banana', 'orange', 'grape', 'lemon', 'peach',
    'cherry', 'melon', 'mango', 'kiwi', 'plum', 'berry',
    'apricot', 'lime', 'fig', 'pear', 'coconut', 'papaya',
    'avocado', 'guava', 'date', 'olive', 'walnut', 'almond',
  ];

  describe('Task 1 & Happy Path: Synchronous validation with valid params', () => {
    it('returns isValid: true and empty errors object for fully valid inputs', () => {
      const result = validateTransactionInput({
        receiverAddress: validAddressStr,
        amount: '1.5',
        comment: 'Valid payment memo',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
      expect(result.errorKeys).toEqual({});
      expect(result.fieldErrors).toEqual({});
    });

    it('accepts Address instance from @ton/core as receiverAddress', () => {
      const result = validateTransactionInput({
        receiverAddress: validAddressObj,
        amount: 1000000000n,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors.receiverAddress).toBeUndefined();
    });

    it('accepts amounts as number, bigint, or valid string with TON suffix', () => {
      expect(validateTransactionInput({ receiverAddress: validAddressStr, amount: 5 }).isValid).toBe(true);
      expect(validateTransactionInput({ receiverAddress: validAddressStr, amount: 5000000000n }).isValid).toBe(true);
      expect(validateTransactionInput({ receiverAddress: validAddressStr, amount: '0.05 TON' }).isValid).toBe(true);
      expect(validateTransactionInput({ receiverAddress: validAddressStr, amount: '10 ton' }).isValid).toBe(true);
    });

    it('allows empty or omitted comment (comment is optional)', () => {
      expect(validateTransactionInput({ receiverAddress: validAddressStr, amount: 1 }).isValid).toBe(true);
      expect(validateTransactionInput({ receiverAddress: validAddressStr, amount: 1, comment: '' }).isValid).toBe(true);
      expect(validateTransactionInput({ receiverAddress: validAddressStr, amount: 1, comment: undefined }).isValid).toBe(true);
      expect(validateTransactionInput({ receiverAddress: validAddressStr, amount: 1, comment: null }).isValid).toBe(true);
    });
  });

  describe('Task 2 & AC 1: Address format validation using Address.parse() with try-catch', () => {
    it('rejects invalid address strings with exact message "Invalid TON address format"', () => {
      const invalidAddresses = [
        'not-a-ton-address',
        'EQInvalidAddressChecksum12345',
        '0:12345',
        'kQ',
        'http://malicious-url.com',
      ];

      for (const addr of invalidAddresses) {
        const result = validateTransactionInput({
          receiverAddress: addr,
          amount: '1',
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.receiverAddress).toBe('Invalid TON address format');
        expect(result.errorKeys.receiverAddress).toBe(TRANSACTION_VALIDATION_ERROR_KEYS.INVALID_ADDRESS);
        expect(result.fieldErrors.receiverAddress).toEqual({
          key: TRANSACTION_VALIDATION_ERROR_KEYS.INVALID_ADDRESS,
          message: 'Invalid TON address format',
        });
      }
    });

    it('rejects null, undefined, empty, or whitespace-only address with "Invalid TON address format"', () => {
      const emptyValues = [null, undefined, '', '   ', '\t\n'];

      for (const val of emptyValues) {
        const result = validateTransactionInput({
          receiverAddress: val as any,
          amount: '1',
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.receiverAddress).toBe('Invalid TON address format');
      }
    });

    it('rejects non-string non-Address types (e.g. number, object)', () => {
      const invalidTypes = [12345, true, {}, { raw: 'invalid' }];

      for (const val of invalidTypes) {
        const result = validateTransactionInput({
          receiverAddress: val as any,
          amount: '1',
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.receiverAddress).toBe('Invalid TON address format');
      }
    });

    it('accepts trimmed valid address with surrounding whitespace', () => {
      const result = validateTransactionInput({
        receiverAddress: `  ${validAddressStr}  \n`,
        amount: '1',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors.receiverAddress).toBeUndefined();
    });
  });

  describe('Task 3 & AC 2: Amount validation (positive number, finite, > min transfer value)', () => {
    it('rejects zero amount (0, 0n, "0") with "Amount must be greater than 0"', () => {
      const zeroAmounts = [0, 0n, '0', '0.0', '0 TON', '0.00 ton'];

      for (const zero of zeroAmounts) {
        const result = validateTransactionInput({
          receiverAddress: validAddressStr,
          amount: zero,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.amount).toBe('Amount must be greater than 0');
        expect(result.errorKeys.amount).toBe(TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO);
        expect(result.fieldErrors.amount).toEqual({
          key: TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO,
          message: 'Amount must be greater than 0',
        });
      }
    });

    it('rejects negative amounts (-1, -0.5, "-5") with "Amount must be greater than 0"', () => {
      const negativeAmounts = [-1, -0.001, -100n, '-5', '-0.5', '-10 TON'];

      for (const neg of negativeAmounts) {
        const result = validateTransactionInput({
          receiverAddress: validAddressStr,
          amount: neg,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.amount).toBe('Amount must be greater than 0');
        expect(result.errorKeys.amount).toBe(TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO);
      }
    });

    it('rejects null, undefined, or empty amount with "Amount must be greater than 0"', () => {
      const emptyAmounts = [null, undefined, '', '   '];

      for (const empty of emptyAmounts) {
        const result = validateTransactionInput({
          receiverAddress: validAddressStr,
          amount: empty as any,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.amount).toBe('Amount must be greater than 0');
      }
    });

    it('rejects non-finite numbers (NaN, Infinity, -Infinity)', () => {
      const nonFinite = [NaN, Infinity, -Infinity];

      for (const val of nonFinite) {
        const result = validateTransactionInput({
          receiverAddress: validAddressStr,
          amount: val,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.amount).toBeDefined();
      }
    });

    it('rejects unparseable non-numeric strings', () => {
      const result = validateTransactionInput({
        receiverAddress: validAddressStr,
        amount: 'abc',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.amount).toBeDefined();
    });

    it('enforces custom minTransferValue when configured in options', () => {
      const result = validateTransactionInput(
        {
          receiverAddress: validAddressStr,
          amount: '0.1', // 0.1 TON
        },
        {
          minTransferValue: '0.5', // minimum 0.5 TON required
        }
      );

      expect(result.isValid).toBe(false);
      expect(result.errorKeys.amount).toBe(TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_BELOW_MINIMUM);
      expect(result.errors.amount).toBe('Amount must be greater than minimum transfer value');
    });
  });

  describe('Task 4: Comment length validation (<120 bytes for standard messages)', () => {
    it('accepts comment with length strictly less than 120 bytes', () => {
      // 119 ASCII characters = 119 bytes (< 120)
      const validComment = 'a'.repeat(119);
      const result = validateTransactionInput({
        receiverAddress: validAddressStr,
        amount: '1',
        comment: validComment,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors.comment).toBeUndefined();
    });

    it('rejects comment of exactly 120 bytes (Task 4: "<120 bytes for standard messages")', () => {
      const comment120Bytes = 'a'.repeat(120);
      const result = validateTransactionInput({
        receiverAddress: validAddressStr,
        amount: '1',
        comment: comment120Bytes,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.comment).toBe('Comment must be less than 120 bytes');
      expect(result.errorKeys.comment).toBe(TRANSACTION_VALIDATION_ERROR_KEYS.COMMENT_TOO_LONG);
      expect(result.fieldErrors.comment).toEqual({
        key: TRANSACTION_VALIDATION_ERROR_KEYS.COMMENT_TOO_LONG,
        message: 'Comment must be less than 120 bytes',
      });
    });

    it('rejects comments significantly exceeding 120 bytes', () => {
      const longComment = 'This is a very long payment description '.repeat(10); // ~400 bytes
      const result = validateTransactionInput({
        receiverAddress: validAddressStr,
        amount: '1',
        comment: longComment,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.comment).toBe('Comment must be less than 120 bytes');
    });

    it('correctly calculates multi-byte UTF-8 character length (e.g. Cyrillic & emojis)', () => {
      // Cyrillic characters are 2 bytes each in UTF-8
      // 59 Cyrillic characters = 118 bytes (< 120) -> valid
      const validCyrillic = 'Привет мир '.repeat(5) + 'Привет'; // 59 chars
      const byteLenValid = new TextEncoder().encode(validCyrillic).length;
      expect(byteLenValid).toBeLessThan(120);

      const validResult = validateTransactionInput({
        receiverAddress: validAddressStr,
        amount: '1',
        comment: validCyrillic,
      });
      expect(validResult.isValid).toBe(true);

      // 60 Cyrillic characters = 120 bytes (>= 120) -> rejected
      const invalidCyrillic = 'й'.repeat(60);
      const byteLenInvalid = new TextEncoder().encode(invalidCyrillic).length;
      expect(byteLenInvalid).toBe(120);

      const invalidResult = validateTransactionInput({
        receiverAddress: validAddressStr,
        amount: '1',
        comment: invalidCyrillic,
      });
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.comment).toBe('Comment must be less than 120 bytes');

      // 4-byte emoji test (🚀 is 4 bytes)
      // 30 emojis = 120 bytes -> rejected
      const emojis = '🚀'.repeat(30);
      expect(new TextEncoder().encode(emojis).length).toBe(120);

      const emojiResult = validateTransactionInput({
        receiverAddress: validAddressStr,
        amount: '1',
        comment: emojis,
      });
      expect(emojiResult.isValid).toBe(false);
      expect(emojiResult.errors.comment).toBe('Comment must be less than 120 bytes');
    });
  });

  describe('Task 5: Structured validation errors (field-specific messages)', () => {
    it('returns simultaneous structured errors for all invalid fields', () => {
      const result = validateTransactionInput({
        receiverAddress: 'invalid-address',
        amount: -5,
        comment: 'x'.repeat(150),
      });

      expect(result.isValid).toBe(false);

      // All 3 fields have their specific messages
      expect(result.errors.receiverAddress).toBe('Invalid TON address format');
      expect(result.errors.amount).toBe('Amount must be greater than 0');
      expect(result.errors.comment).toBe('Comment must be less than 120 bytes');

      // All 3 fields have their specific keys
      expect(result.errorKeys.receiverAddress).toBe(TRANSACTION_VALIDATION_ERROR_KEYS.INVALID_ADDRESS);
      expect(result.errorKeys.amount).toBe(TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO);
      expect(result.errorKeys.comment).toBe(TRANSACTION_VALIDATION_ERROR_KEYS.COMMENT_TOO_LONG);

      // All 3 fields have structured fieldErrors descriptors
      expect(result.fieldErrors.receiverAddress?.key).toBe(TRANSACTION_VALIDATION_ERROR_KEYS.INVALID_ADDRESS);
      expect(result.fieldErrors.amount?.key).toBe(TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO);
      expect(result.fieldErrors.comment?.key).toBe(TRANSACTION_VALIDATION_ERROR_KEYS.COMMENT_TOO_LONG);
    });

    it('returns only relevant field errors when one field is invalid and others are valid', () => {
      const result = validateTransactionInput({
        receiverAddress: validAddressStr,
        amount: -1,
        comment: 'Valid comment',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.amount).toBe('Amount must be greater than 0');
      expect(result.errors.receiverAddress).toBeUndefined();
      expect(result.errors.comment).toBeUndefined();
    });

    it('safely handles null/undefined params argument', () => {
      const result = validateTransactionInput(null);

      expect(result.isValid).toBe(false);
      expect(result.errors.receiverAddress).toBe('Invalid TON address format');
      expect(result.errors.amount).toBe('Amount must be greater than 0');
    });
  });

  describe('AC 3: Synchronous execution benchmark (<1ms)', () => {
    it('executes synchronously in well under 1ms per call', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        validateTransactionInput({
          receiverAddress: validAddressStr,
          amount: '1.25',
          comment: 'Performance benchmark comment',
        });
        validateTransactionInput({
          receiverAddress: 'invalid-address',
          amount: -1,
          comment: 'x'.repeat(200),
        });
      }

      const totalTimeMs = performance.now() - startTime;
      const averageTimePerCallMs = totalTimeMs / (iterations * 2);

      // Must be < 1ms
      expect(averageTimePerCallMs).toBeLessThan(1);
      // Typically takes < 0.05ms
      expect(averageTimePerCallMs).toBeLessThan(0.1);
    });
  });

  describe('AC 4: Localized-ready error messages (keys & custom translation dictionaries)', () => {
    it('uses stable keys in errorKeys regardless of default message strings', () => {
      const result = validateTransactionInput({
        receiverAddress: 'bad-addr',
        amount: 0,
        comment: 'x'.repeat(130),
      });

      expect(result.errorKeys.receiverAddress).toBe('INVALID_TON_ADDRESS_FORMAT');
      expect(result.errorKeys.amount).toBe('AMOUNT_MUST_BE_GREATER_THAN_0');
      expect(result.errorKeys.comment).toBe('COMMENT_TOO_LONG');
    });

    it('supports custom localized message dictionaries via options.messages', () => {
      const customRussianMessages = {
        [TRANSACTION_VALIDATION_ERROR_KEYS.INVALID_ADDRESS]: 'Неверный формат TON-адреса',
        [TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO]: 'Сумма перевода должна быть больше 0',
        [TRANSACTION_VALIDATION_ERROR_KEYS.COMMENT_TOO_LONG]: 'Комментарий слишком длинный (должен быть меньше 120 байт)',
      };

      const result = validateTransactionInput(
        {
          receiverAddress: 'bad-addr',
          amount: 0,
          comment: 'x'.repeat(130),
        },
        {
          messages: customRussianMessages,
        }
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.receiverAddress).toBe('Неверный формат TON-адреса');
      expect(result.errors.amount).toBe('Сумма перевода должна быть больше 0');
      expect(result.errors.comment).toBe('Комментарий слишком длинный (должен быть меньше 120 байт)');

      // Keys remain consistent for program logic
      expect(result.errorKeys.receiverAddress).toBe(TRANSACTION_VALIDATION_ERROR_KEYS.INVALID_ADDRESS);
      expect(result.errorKeys.amount).toBe(TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO);
      expect(result.errorKeys.comment).toBe(TRANSACTION_VALIDATION_ERROR_KEYS.COMMENT_TOO_LONG);
    });
  });

  describe('Integration with sendTransaction: Rejects before making any network API calls', () => {
    it('rejects invalid address immediately before calling TonClient RPC', async () => {
      const mockClient = {
        isContractDeployed: vi.fn(),
        getBalance: vi.fn(),
        getSeqno: vi.fn(),
        open: vi.fn(),
      } as unknown as TonClient;

      await expect(
        sendTransaction(validMnemonics, 'invalid-address', '1', { client: mockClient })
      ).rejects.toThrow(/Invalid TON address: Invalid TON address format/i);

      // Verify no RPC calls were made!
      expect(mockClient.isContractDeployed).not.toHaveBeenCalled();
      expect(mockClient.getBalance).not.toHaveBeenCalled();
      expect(mockClient.open).not.toHaveBeenCalled();
    });

    it('rejects zero or negative amount immediately before calling TonClient RPC', async () => {
      const mockClient = {
        isContractDeployed: vi.fn(),
        getBalance: vi.fn(),
        getSeqno: vi.fn(),
        open: vi.fn(),
      } as unknown as TonClient;

      await expect(
        sendTransaction(validMnemonics, validAddressStr, 0, { client: mockClient })
      ).rejects.toThrow(/Invalid amount: Amount must be greater than 0/i);

      await expect(
        sendTransaction(validMnemonics, validAddressStr, -5, { client: mockClient })
      ).rejects.toThrow(/Invalid amount: Amount must be greater than 0/i);

      // Verify no RPC calls were made!
      expect(mockClient.isContractDeployed).not.toHaveBeenCalled();
      expect(mockClient.getBalance).not.toHaveBeenCalled();
    });

    it('rejects comment >= 120 bytes immediately before calling TonClient RPC', async () => {
      const mockClient = {
        isContractDeployed: vi.fn(),
        getBalance: vi.fn(),
        getSeqno: vi.fn(),
        open: vi.fn(),
      } as unknown as TonClient;

      await expect(
        sendTransaction(
          {
            senderMnemonics: validMnemonics,
            receiverAddress: validAddressStr,
            amount: '1',
            comment: 'x'.repeat(125),
          },
          { client: mockClient }
        )
      ).rejects.toThrow(/Invalid comment: Comment must be less than 120 bytes/i);

      // Verify no RPC calls were made!
      expect(mockClient.isContractDeployed).not.toHaveBeenCalled();
      expect(mockClient.getBalance).not.toHaveBeenCalled();
    });
  });
});
