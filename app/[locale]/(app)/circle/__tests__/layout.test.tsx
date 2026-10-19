import { describe, expect, it, vi } from 'vitest';

// Only `generateMetadata` is under test; the layout's chrome is client UI.
vi.mock('@/components/groups/circle-add-menu', () => ({
  CircleAddMenu: () => null,
}));
vi.mock('@/components/groups/circle-meal-bar', () => ({
  CircleMealBar: () => null,
}));
vi.mock('@/components/groups/meal-invites/meal-invites', () => ({
  MealInvites: () => null,
}));
vi.mock('@/components/groups/view-switcher', () => ({
  ViewSwitcher: () => null,
}));

const { generateMetadata } = await import('../layout');

describe('circle layout metadata', () => {
  // The group feed and the share thread are Client Component pages, which
  // cannot export metadata, so this layout is what names their tab.
  it('gives every Circle route a tab title from the existing messages', async () => {
    // The global next-intl/server mock returns each key as-is.
    expect(await generateMetadata()).toEqual({ title: 'title' });
  });
});
