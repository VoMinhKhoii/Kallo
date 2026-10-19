import { describe, expect, it, vi } from 'vitest';

// Only `generateMetadata` is under test; keep the page's data layer out.
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/components/app/timezone-cookie', () => ({
  TIMEZONE_COOKIE: 'tz',
  TimezoneCookie: () => null,
}));
vi.mock('@/components/logging/logging-shell', () => ({
  LoggingShell: () => null,
}));
vi.mock('@/lib/actions/meals/day/day-has-entries', () => ({
  dayHasEntries: vi.fn(),
}));
vi.mock('@/lib/infra/auth/session', () => ({
  requireAuthAndProfile: vi.fn(),
}));

const { generateMetadata } = await import('../page');

describe('logging page metadata', () => {
  it('names the tab after the sidebar entry instead of the landing pitch', async () => {
    // The global next-intl/server mock returns each key as-is: the page reads
    // `nav.logging`, the label the sidebar already shows.
    expect(await generateMetadata()).toEqual({ title: 'logging' });
  });
});
