import { Address, toNano } from '@ton/core';

/**
 * Localization keys for transaction input validation errors.
 * Using keys rather than hardcoded strings enables i18n support.
 */
export const TRANSACTION_VALIDATION_ERROR_KEYS = {
  INVALID_ADDRESS: 'INVALID_TON_ADDRESS_FORMAT',
  AMOUNT_REQUIRED: 'AMOUNT_REQUIRED',
  AMOUNT_NOT_FINITE: 'AMOUNT_NOT_FINITE',
  AMOUNT_MUST_BE_GREATER_THAN_ZERO: 'AMOUNT_MUST_BE_GREATER_THAN_0',
  AMOUNT_PARSE_ERROR: 'AMOUNT_PARSE_ERROR',
  AMOUNT_BELOW_MINIMUM: 'AMOUNT_BELOW_MINIMUM',
  COMMENT_TOO_LONG: 'COMMENT_TOO_LONG',
  MNEMONIC_INVALID: 'MNEMONIC_INVALID',
} as const;

export type TransactionValidationKey =
  (typeof TRANSACTION_VALIDATION_ERROR_KEYS)[keyof typeof TRANSACTION_VALIDATION_ERROR_KEYS];

/**
 * Default human-readable error messages for each error key.
 * Can be overridden via ValidationOptions for localization.
 */
export const DEFAULT_TRANSACTION_VALIDATION_MESSAGES: Record<TransactionValidationKey, string> = {
  [TRANSACTION_VALIDATION_ERROR_KEYS.INVALID_ADDRESS]: 'Invalid TON address format',
  [TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_REQUIRED]: 'Amount is required',
  [TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_NOT_FINITE]: 'Amount must be a finite number',
  [TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO]: 'Amount must be greater than 0',
  [TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_PARSE_ERROR]: 'Invalid amount format',
  [TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_BELOW_MINIMUM]: 'Amount must be greater than minimum transfer value',
  [TRANSACTION_VALIDATION_ERROR_KEYS.COMMENT_TOO_LONG]: 'Comment must be less than 120 bytes',
  [TRANSACTION_VALIDATION_ERROR_KEYS.MNEMONIC_INVALID]: 'Invalid mnemonic format',
};

/**
 * Parameters to validate before making network requests or building a transaction.
 */
export interface ValidateTransactionInputParams {
  receiverAddress?: string | Address | null;
  amount?: bigint | number | string | null;
  comment?: string | null;
  bounceable?: boolean;
  senderMnemonics?: string[] | null;
}

/**
 * Options to customize validation rules and localized messages.
 */
export interface ValidationOptions {
  /**
   * Custom dictionary for localized error messages.
   */
  messages?: Partial<Record<TransactionValidationKey, string>>;

  /**
   * Minimum allowed transfer value in nanoTON or TON.
   * Defaults to 0 (must be > 0).
   */
  minTransferValue?: bigint | number | string;

  /**
   * Maximum allowed comment length in bytes.
   * Standard TON messages require < 120 bytes (default: 120).
   */
  maxCommentBytes?: number;
}

/**
 * Detailed error descriptor containing both the localization key and message.
 */
export interface FieldErrorDetail {
  key: TransactionValidationKey;
  message: string;
}

/**
 * Structured validation result returned by validateTransactionInput.
 */
export interface TransactionValidationResult {
  /**
   * Whether all validated inputs are valid.
   */
  isValid: boolean;

  /**
   * Map of field names to human-readable error messages.
   * e.g. errors.receiverAddress === "Invalid TON address format"
   */
  errors: {
    receiverAddress?: string;
    amount?: string;
    comment?: string;
    senderMnemonics?: string;
    [field: string]: string | undefined;
  };

  /**
   * Map of field names to localization keys.
   * e.g. errorKeys.receiverAddress === "INVALID_TON_ADDRESS_FORMAT"
   */
  errorKeys: {
    receiverAddress?: TransactionValidationKey;
    amount?: TransactionValidationKey;
    comment?: TransactionValidationKey;
    senderMnemonics?: TransactionValidationKey;
    [field: string]: TransactionValidationKey | undefined;
  };

  /**
   * Structured error details per field with both key and message.
   */
  fieldErrors: {
    receiverAddress?: FieldErrorDetail;
    amount?: FieldErrorDetail;
    comment?: FieldErrorDetail;
    senderMnemonics?: FieldErrorDetail;
    [field: string]: FieldErrorDetail | undefined;
  };
}

/**
 * Converts any amount input (bigint, number, string) to nanoTON bigint.
 * Throws an error key if conversion fails or if the value is invalid.
 */
function parseAmountInternal(
  amount: bigint | number | string | null | undefined
): { nano?: bigint; errorKey?: TransactionValidationKey } {
  if (amount === null || amount === undefined) {
    return { errorKey: TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO };
  }

  if (typeof amount === 'bigint') {
    if (amount <= 0n) {
      return { errorKey: TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO };
    }
    return { nano: amount };
  }

  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) {
      if (amount <= 0) {
        return { errorKey: TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO };
      }
      return { errorKey: TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_NOT_FINITE };
    }
    if (amount <= 0) {
      return { errorKey: TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO };
    }
    try {
      const nano = toNano(amount.toString());
      if (nano <= 0n) {
        return { errorKey: TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO };
      }
      return { nano };
    } catch {
      return { errorKey: TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_PARSE_ERROR };
    }
  }

  if (typeof amount === 'string') {
    const trimmed = amount.trim();
    if (!trimmed) {
      return { errorKey: TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO };
    }

    const cleaned = trimmed.replace(/\s*ton$/i, '').trim();
    if (!cleaned) {
      return { errorKey: TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO };
    }

    // Check if numeric string represents a negative or zero value
    const numericValue = Number(cleaned);
    if (!Number.isNaN(numericValue) && numericValue <= 0) {
      return { errorKey: TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO };
    }

    try {
      const nano = toNano(cleaned);
      if (nano <= 0n) {
        return { errorKey: TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO };
      }
      return { nano };
    } catch {
      // If parsing toNano fails but numeric representation was negative or zero
      if (!Number.isNaN(numericValue) && numericValue <= 0) {
        return { errorKey: TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_MUST_BE_GREATER_THAN_ZERO };
      }
      return { errorKey: TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_PARSE_ERROR };
    }
  }

  return { errorKey: TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_PARSE_ERROR };
}

/**
 * Calculates byte length of a string in UTF-8 encoding.
 * Isomorphic: works across modern browser environments and Node.js.
 */
function getUtf8ByteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(str, 'utf8');
  }
  // Fallback for environments without TextEncoder or Buffer
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const codePoint = str.codePointAt(i);
    if (codePoint === undefined) continue;
    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
      i++; // Surrogate pair
    }
  }
  return bytes;
}

/**
 * Synchronously validates all transaction input parameters before making any network API calls.
 * Runs in < 1ms, returns structured field errors, and uses localized-ready error keys.
 *
 * @param params Transaction input parameters (receiverAddress, amount, comment, etc.)
 * @param options Optional configuration for custom messages, min transfer value, or comment byte limits
 * @returns TransactionValidationResult with isValid boolean and field-specific errors
 */
export function validateTransactionInput(
  params?: ValidateTransactionInputParams | null,
  options?: ValidationOptions
): TransactionValidationResult {
  const errors: TransactionValidationResult['errors'] = {};
  const errorKeys: TransactionValidationResult['errorKeys'] = {};
  const fieldErrors: TransactionValidationResult['fieldErrors'] = {};

  const getMessage = (key: TransactionValidationKey): string => {
    return options?.messages?.[key] ?? DEFAULT_TRANSACTION_VALIDATION_MESSAGES[key] ?? key;
  };

  const addError = (field: string, key: TransactionValidationKey) => {
    const message = getMessage(key);
    errors[field] = message;
    errorKeys[field] = key;
    fieldErrors[field] = { key, message };
  };

  // 1. Validate receiver address (Task 2 & AC 1)
  const receiverAddress = params?.receiverAddress;
  if (!receiverAddress) {
    addError('receiverAddress', TRANSACTION_VALIDATION_ERROR_KEYS.INVALID_ADDRESS);
  } else if (typeof receiverAddress === 'object' && 'toRawString' in receiverAddress) {
    // Already a valid @ton/core Address instance
  } else if (typeof receiverAddress === 'string') {
    const trimmed = receiverAddress.trim();
    if (!trimmed) {
      addError('receiverAddress', TRANSACTION_VALIDATION_ERROR_KEYS.INVALID_ADDRESS);
    } else {
      try {
        Address.parse(trimmed);
      } catch {
        addError('receiverAddress', TRANSACTION_VALIDATION_ERROR_KEYS.INVALID_ADDRESS);
      }
    }
  } else {
    addError('receiverAddress', TRANSACTION_VALIDATION_ERROR_KEYS.INVALID_ADDRESS);
  }

  // 2. Validate amount (Task 3 & AC 2)
  const amount = params?.amount;
  const parsedAmount = parseAmountInternal(amount);

  if (parsedAmount.errorKey) {
    addError('amount', parsedAmount.errorKey);
  } else if (parsedAmount.nano !== undefined) {
    // Validate custom minimum transfer value if configured
    if (options?.minTransferValue !== undefined) {
      const parsedMin = parseAmountInternal(options.minTransferValue);
      if (parsedMin.nano !== undefined && parsedAmount.nano < parsedMin.nano) {
        addError('amount', TRANSACTION_VALIDATION_ERROR_KEYS.AMOUNT_BELOW_MINIMUM);
      }
    }
  }

  // 3. Validate comment length (<120 bytes for standard messages) (Task 4)
  const comment = params?.comment;
  if (comment !== null && comment !== undefined && comment !== '') {
    const maxBytes = options?.maxCommentBytes ?? 120;
    const byteLength = getUtf8ByteLength(comment);
    // Task 4: "<120 bytes for standard messages" -> byteLength must be strictly less than maxBytes (120)
    if (byteLength >= maxBytes) {
      addError('comment', TRANSACTION_VALIDATION_ERROR_KEYS.COMMENT_TOO_LONG);
    }
  }

  // 4. Optional: validate mnemonics if explicitly provided in params
  if (params?.senderMnemonics !== undefined && params?.senderMnemonics !== null) {
    if (!Array.isArray(params.senderMnemonics) || params.senderMnemonics.length === 0) {
      addError('senderMnemonics', TRANSACTION_VALIDATION_ERROR_KEYS.MNEMONIC_INVALID);
    } else {
      const hasInvalidWord = params.senderMnemonics.some(
        (w) => typeof w !== 'string' || !w.trim()
      );
      if (hasInvalidWord) {
        addError('senderMnemonics', TRANSACTION_VALIDATION_ERROR_KEYS.MNEMONIC_INVALID);
      }
    }
  }

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    errors,
    errorKeys,
    fieldErrors,
  };
}
