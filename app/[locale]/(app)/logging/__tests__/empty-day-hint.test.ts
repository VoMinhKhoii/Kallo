import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIMEZONE_COOKIE } from '@/lib/core/date/timezone-cookie';

// The page tells the client where the composer belongs before the day loads:
// centred on an empty day, docked under meals. Prod sent "unknown" on every
// load until 2026-10-27 (the cookie name was imported from a 'use client'
// module, which a Server Component receives as a reference, not the string),
// so every empty day docked the composer and then jumped it to the centre.

const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
  }),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/components/app/timezone-cookie', () => ({
  TimezoneCookie: () => null,
}));
const LoggingShell = vi.hoisted(() => () => null);
vi.mock('@/components/logging/logging-shell', () => ({ LoggingShell }));
const dayHasEntries = vi.hoisted(() => vi.fn());
vi.mock('@/lib/actions/meals/day/day-has-entries', () => ({ dayHasEntries }));
vi.mock('@/lib/infra/auth/session', () => ({
  requireAuthAndProfile: async () => ({
    user: { id: 'u1' },
    profile: { goal: 'maintaining' },
  }),
}));

const { default: LoggingPage } = await import('../page');

/** The `initiallyHasEntries` the page hands the logging shell. */
async function hint() {
  const tree = await LoggingPage({ searchParams: Promise.resolve({}) });
  const shell = (
    tree.props.children as { type: unknown; props: Record<string, unknown> }[]
  ).find((child) => child.type === LoggingShell);
  return shell?.props.initiallyHasEntries;
}

beforeEach(() => {
  cookieJar.clear();
  dayHasEntries.mockReset();
});

describe('logging page empty-day hint', () => {
  it('reads the offset cookie and answers for today', async () => {
    cookieJar.set(TIMEZONE_COOKIE, '-420');
    dayHasEntries.mockResolvedValue(false);

    expect(await hint()).toBe(false);
    expect(dayHasEntries).toHaveBeenCalledWith(
      expect.objectContaining({ timezoneOffset: -420 })
    );
  });

  it('stays unknown on a first visit, before the cookie exists', async () => {
    expect(await hint()).toBeUndefined();
    expect(dayHasEntries).not.toHaveBeenCalled();
  });
});
