import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Capitalize the first letter of a string, preserving the rest.
 * Handles Vietnamese diacritics correctly (e.g., "gạo tẻ" → "Gạo tẻ").
 */
export function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Parse a user-entered numeric string into a number, tolerating the comma
 * decimal separator that iOS/EU keyboards emit (e.g. "65,3" → 65.3).
 * Returns NaN for blank input so Zod number validation rejects it.
 */
export function parseDecimalInput(value: string | number): number {
  if (typeof value === 'number') return value;
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return Number.NaN;
  return Number(normalized);
}

/**
 * Run an async function over items with bounded concurrency.
 * Returns PromiseSettledResult[] in the same order as the input.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit: number
): Promise<PromiseSettledResult<R>[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('limit must be a positive integer');
  }

  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i]) };
      } catch (reason: unknown) {
        results[i] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}
