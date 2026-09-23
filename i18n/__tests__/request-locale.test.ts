import { beforeEach, describe, expect, it, vi } from 'vitest';

const rootLocale = vi.fn<() => Promise<string | undefined>>();
vi.mock('next/root-params', () => ({ locale: () => rootLocale() }));

const { resolveRequestLocale } = await import('../request-locale');

const neverRead = () => {
  throw new Error('the header locale must not be read here');
};

beforeEach(() => {
  rootLocale.mockReset();
});

describe('resolveRequestLocale', () => {
  it('uses the [locale] root param without touching the request header', async () => {
    rootLocale.mockResolvedValue('vi');

    await expect(
      resolveRequestLocale({
        override: undefined,
        readRequestLocale: neverRead,
      })
    ).resolves.toBe('vi');
  });

  it('prefers an explicit locale over the route', async () => {
    rootLocale.mockResolvedValue('vi');

    await expect(
      resolveRequestLocale({ override: 'en', readRequestLocale: neverRead })
    ).resolves.toBe('en');
    expect(rootLocale).not.toHaveBeenCalled();
  });

  // Server Actions and Route Handlers: next/root-params throws synchronously.
  it('falls back to the header locale where root params are unsupported', async () => {
    rootLocale.mockImplementation(() => {
      throw new Error('used inside a Server Action');
    });

    await expect(
      resolveRequestLocale({
        override: undefined,
        readRequestLocale: async () => 'vi',
      })
    ).resolves.toBe('vi');
  });

  it('falls back to the default locale for an unknown segment', async () => {
    rootLocale.mockResolvedValue('xx');

    await expect(
      resolveRequestLocale({
        override: undefined,
        readRequestLocale: neverRead,
      })
    ).resolves.toBe('en');
  });
});
