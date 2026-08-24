import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { locales } from '@/i18n/config';
import {
  absolutiseLinks,
  parseFrontmatter,
  stripComponents,
  stripFrontmatter,
} from '@/lib/domain/docs/markdown/to-markdown';
import { DOCS_SLUGS } from '@/lib/domain/docs/navigation';

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'docs');

function convert(locale: string, slug: string): string {
  const source = readFileSync(
    path.join(CONTENT_ROOT, locale, `${slug}.mdx`),
    'utf8'
  );
  return stripComponents(
    absolutiseLinks(stripFrontmatter(source), {
      siteUrl: 'https://kallo.fit',
      locale,
    })
  );
}

describe('every real docs page converts to clean Markdown', () => {
  // The transform recognises exactly the four components the docs use. This is
  // what fails when a fifth is added — before a page ships with a stray JSX tag
  // in its Markdown representation.
  it('leaves no JSX component tags behind', () => {
    const offenders: string[] = [];

    for (const locale of locales) {
      for (const slug of DOCS_SLUGS) {
        const body = convert(locale, slug);
        // Strip fenced blocks first: a docs page may legitimately *show* JSX.
        const prose = body.replace(/```[\s\S]*?```/g, '');
        const match = prose.match(/<\/?[A-Z][A-Za-z]*/);
        if (match) offenders.push(`${locale}/${slug}: ${match[0]}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('leaves no root-relative links', () => {
    // A Markdown file has no base URL, so a relative link in one is a dead end
    // for anything that fetched it out of band.
    const offenders: string[] = [];

    for (const locale of locales) {
      for (const slug of DOCS_SLUGS) {
        const body = convert(locale, slug).replace(/```[\s\S]*?```/g, '');
        for (const match of body.matchAll(/\]\((\/[^/)][^)\s]*)\)/g)) {
          offenders.push(`${locale}/${slug}: ${match[1]}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('parses the three required frontmatter fields on every page', () => {
    // `parseFrontmatter` reads the source instead of importing the compiled
    // MDX module. This is what holds that shortcut honest across the corpus.
    for (const locale of locales) {
      for (const slug of DOCS_SLUGS) {
        const source = readFileSync(
          path.join(CONTENT_ROOT, locale, `${slug}.mdx`),
          'utf8'
        );
        const frontmatter = parseFrontmatter(source);
        expect(frontmatter, `${locale}/${slug}`).not.toBeNull();
        expect(frontmatter?.title, `${locale}/${slug}`).toBeTruthy();
        expect(frontmatter?.description, `${locale}/${slug}`).toBeTruthy();
        expect(frontmatter?.lastUpdated, `${locale}/${slug}`).toMatch(
          /^\d{4}-\d{2}-\d{2}$/
        );
      }
    }
  });

  it('produces something substantial for every page', () => {
    for (const locale of locales) {
      for (const slug of DOCS_SLUGS) {
        expect(convert(locale, slug).length).toBeGreaterThan(200);
      }
    }
  });
});
