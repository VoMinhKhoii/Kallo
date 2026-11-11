import { describe, expect, it } from 'vitest';
import { localeSwitchPath } from '../locale-switch';

describe('localeSwitchPath', () => {
  it('sends an English-only alternatives page to the home page', () => {
    expect(localeSwitchPath('/alternatives/cal-ai', 'vi')).toBe('/');
    expect(localeSwitchPath('/alternatives/cal-ai', 'en')).toBe(
      '/alternatives/cal-ai'
    );
  });

  it('keeps every other path, and the food-page hub rule', () => {
    expect(localeSwitchPath('/pricing', 'vi')).toBe('/pricing');
    expect(localeSwitchPath('/calories/chicken-burrito', 'vi')).toBe(
      '/calories'
    );
  });
});
