import { describe, expect, it } from 'vitest';
import { formatMoney, yearlySavePercent } from '../web-prices';

describe('yearlySavePercent', () => {
  const usd = (amount: number) => ({ amount, currency: 'USD' });
  const vnd = (amount: number) => ({ amount, currency: 'VND' });

  it('matches the sheet: 69% in USD, 24% in VND', () => {
    expect(yearlySavePercent({ monthly: usd(7.99), yearly: usd(29.99) })).toBe(
      69
    );
    expect(
      yearlySavePercent({ monthly: vnd(49000), yearly: vnd(449000) })
    ).toBe(24);
  });

  it('is null across currencies, or for a broken or zero monthly amount', () => {
    expect(
      yearlySavePercent({ monthly: usd(7.99), yearly: vnd(449000) })
    ).toBeNull();
    expect(
      yearlySavePercent({ monthly: usd(Number.NaN), yearly: usd(29.99) })
    ).toBeNull();
    expect(
      yearlySavePercent({ monthly: usd(0), yearly: usd(29.99) })
    ).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats in the page language without inventing đồng decimals', () => {
    expect(formatMoney({ amount: 7.99, currency: 'USD' }, 'en')).toBe('$7.99');
    // Intl separates the symbol with a no-break space.
    expect(formatMoney({ amount: 49000, currency: 'VND' }, 'vi')).toBe(
      '49.000\u00a0₫'
    );
  });
});
