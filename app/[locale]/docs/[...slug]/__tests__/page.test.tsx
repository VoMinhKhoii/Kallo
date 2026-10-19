import { describe, expect, it, vi } from 'vitest';

// The global next-intl mock has no `hasLocale`, which the page uses to narrow
// the URL segment. This is the real function's contract, nothing more.
vi.mock('next-intl', () => ({
  hasLocale: (locales: readonly string[], locale: string) =>
    locales.includes(locale),
}));

// The loader imports the compiled `.mdx`, which vitest has no pipeline for.
const { loadDocMock } = vi.hoisted(() => ({ loadDocMock: vi.fn() }));
vi.mock('@/lib/domain/docs/loader', () => ({ loadDoc: loadDocMock }));

const { generateMetadata } = await import('../page');

describe('generateMetadata og:locale', () => {
  it.each([
    ['en', 'en_US'],
    ['vi', 'vi_VN'],
  ])('writes %s as %s', async (locale, expected) => {
    loadDocMock.mockResolvedValue({
      frontmatter: { title: 'Title', description: 'Description' },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale, slug: ['overview'] }),
    });

    expect(metadata.openGraph).toMatchObject({ locale: expected });
  });
});
