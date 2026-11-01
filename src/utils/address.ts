import { Address, fromNano } from '@ton/core';

/**
 * Truncates a TON address for clean, safe UI presentation (e.g. "0QAB...070dx").
 * Accepts either a string address or an Address instance from @ton/core.
 *
 * @param address - Address string or Address instance
 * @param startLength - Number of characters to retain from the start (default: 6)
 * @param endLength - Number of characters to retain from the end (default: 6)
 */
export function truncateAddress(
  address: string | Address | null | undefined,
  startLength: number = 6,
  endLength: number = 6
): string {
  if (!address) return '';

  let addressString = '';
  if (typeof address === 'string') {
    addressString = address.trim();
  } else if (typeof address === 'object' && 'toString' in address) {
    try {
      addressString = address.toString({ bounceable: false, urlSafe: true });
    } catch {
      addressString = String(address);
    }
  } else {
    addressString = String(address);
  }

  if (addressString.length <= startLength + endLength) {
    return addressString;
  }

  const start = addressString.slice(0, startLength);
  const end = addressString.slice(-endLength);
  return `${start}...${end}`;
}

/**
 * Formats a transaction amount into human-readable TON string.
 * Supports bigint (nanoTons), numbers, or numeric strings.
 */
export function formatTonAmount(amount: bigint | number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') {
    return '0 TON';
  }

  if (typeof amount === 'bigint') {
    return `${fromNano(amount)} TON`;
  }

  if (typeof amount === 'number') {
    return `${amount} TON`;
  }

  const trimmed = amount.trim();
  if (trimmed.toLowerCase().endsWith('ton')) {
    return trimmed;
  }

  return `${trimmed} TON`;
}

/**
 * Normalizes an address to its full display string format.
 */
export function getFullAddressString(address: string | Address | null | undefined): string {
  if (!address) return '';
  if (typeof address === 'string') return address.trim();
  try {
    return address.toString({ bounceable: false, urlSafe: true });
  } catch {
    return String(address);
  }
}
