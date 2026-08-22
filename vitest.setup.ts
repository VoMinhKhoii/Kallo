import React from 'react';
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// V2 pipeline defaults to ON in production (see lib/ai/pipeline/config/grounded-path-flag.ts).
// Most of the existing test suite was written for v1, so default to v1
// in tests. V2-specific tests call `analyzeMealV2` directly and aren't
// affected by this flag.
if (process.env.PIPELINE_V2_ENABLED === undefined) {
  process.env.PIPELINE_V2_ENABLED = 'false';
}

// server-only throws on import outside RSC; stub it for tests
vi.mock('server-only', () => ({}));

// Global mock for next-intl — returns translation keys as-is
vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return Object.entries(params).reduce(
          (str, [k, v]) => str.replace(`{${k}}`, String(v)),
          key
        );
      }
      return key;
    };
    t.rich = t;
    t.raw = t;
    // The mock carries no messages, so every optional key is genuinely absent.
    // Code that probes with `t.has` must take its fallback branch here.
    t.has = () => false;
    return t;
  },
  useLocale: () => 'en',
  useMessages: () => ({}),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

// Global mock for next-intl server helpers
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'en',
  getTranslations: async () => {
    const t = (key: string) => key;
    t.rich = t;
    t.raw = t;
    t.has = () => false;
    return t;
  },
  getMessages: async () => ({}),
}));

// Global mock for locale-aware navigation
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => {
    return React.createElement('a', { href, ...props }, children);
  },
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  redirect: vi.fn(),
  getPathname: vi.fn((opts: { href: string }) => opts.href),
}));
