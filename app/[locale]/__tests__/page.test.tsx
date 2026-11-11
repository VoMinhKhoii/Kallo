import { describe, expect, it, vi } from 'vitest';

// The global next-intl mock has no `hasLocale`, which the page uses to narrow
// the URL segment. This is the real function's contract, nothing more.
vi.mock('next-intl', () => ({
  hasLocale: (locales: readonly string[], locale: string) =>
    locales.includes(locale),
}));

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock('next/navigation', () => ({ notFound: notFoundMock }));

const { getDocsTreeMock } = vi.hoisted(() => ({ getDocsTreeMock: vi.fn() }));
vi.mock('@/lib/domain/docs/tree', () => ({ getDocsTree: getDocsTreeMock }));

const { default: Home } = await import('../page');

describe('landing page locale', () => {
  // The layout's notFound() does not stop the page: they render in parallel,
  // so a bot hitting `/:param` reached the food-page data with a non-locale
  // and crashed (Sentry KALLO-WEB-C) instead of answering 404.
  it('404s a first segment that is not a locale before reading any data', async () => {
    await expect(
      Home({
        params: Promise.resolve({ locale: ':param' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledOnce();
    expect(getDocsTreeMock).not.toHaveBeenCalled();
  });
});
