import { describe, expect, it } from 'vitest';
import {
  isSettingsPageVisible,
  PINNED_SETTINGS_PAGE,
  parseSettingsPage,
  SETTINGS_GROUPS,
  SETTINGS_PAGES,
} from '../pages';

describe('settings pages', () => {
  it('parses known page ids and nothing else', () => {
    expect(parseSettingsPage('subscriptions')).toBe('subscriptions');
    expect(parseSettingsPage('')).toBeNull();
    expect(parseSettingsPage(null)).toBeNull();
    expect(parseSettingsPage('subscription')).toBeNull();
  });

  it('places every page exactly once across the rail groups and the pin', () => {
    const placed = [...SETTINGS_GROUPS.flat(), PINNED_SETTINGS_PAGE];
    expect([...placed].sort()).toEqual([...SETTINGS_PAGES].sort());
  });

  it('hides the profile-only pages until a profile exists', () => {
    expect(isSettingsPageVisible('body', false)).toBe(false);
    expect(isSettingsPageVisible('cooking', false)).toBe(false);
    expect(isSettingsPageVisible('preferences', false)).toBe(true);
    expect(isSettingsPageVisible('body', true)).toBe(true);
  });
});
