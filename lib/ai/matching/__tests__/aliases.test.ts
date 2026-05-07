import { describe, expect, it } from 'vitest';
import { resolveAlias } from '../aliases';

describe('resolveAlias', () => {
  it.each([
    ['Sugar', 'Đường kính'],
    ['Squid', 'Mực ống'],
    ['Fish sauce', 'Nước mắm'],
    ['Vegetable oil', 'Dầu đậu nành'],
    ['Steamed white rice', 'Cơm'],
  ])('maps English pipeline ingredient "%s"', (input, expected) => {
    expect(resolveAlias(input)).toBe(expected);
  });

  it('leaves unknown ingredients unchanged', () => {
    expect(resolveAlias('unknown ingredient')).toBe('unknown ingredient');
  });
});
