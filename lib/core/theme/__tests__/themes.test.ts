import { describe, expect, it } from 'vitest';
import { APP_THEMES, isThemeChoice, THEME_CHOICES } from '../themes';

describe('theme choices', () => {
  it('offers system plus every theme the app can paint', () => {
    expect(THEME_CHOICES.filter((choice) => choice !== 'system')).toEqual([
      ...APP_THEMES,
    ]);
  });

  it.each([
    ['system', true],
    ['aurora', true],
    ['graphite', false],
    ['', false],
    [undefined, false],
  ])('isThemeChoice(%s) is %s', (value, expected) => {
    expect(isThemeChoice(value)).toBe(expected);
  });
});
