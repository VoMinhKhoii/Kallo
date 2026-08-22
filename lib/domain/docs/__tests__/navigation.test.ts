import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { locales } from '@/i18n/config';
import {
  DOCS_SECTIONS,
  DOCS_SLUGS,
  findSectionForSlug,
  getNeighbours,
  isKnownDocSlug,
} from '@/lib/domain/docs/navigation';

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'docs');

describe('docs navigation', () => {
  it('has a matching .mdx in every locale for every slug', () => {
    // The regression this guards: adding a page in Vietnamese and forgetting
    // the English file (or the reverse) would 404 one language only, which is
    // exactly the kind of breakage nobody notices in review.
    const missing: string[] = [];

    for (const locale of locales) {
      for (const slug of DOCS_SLUGS) {
        const file = path.join(CONTENT_ROOT, locale, `${slug}.mdx`);
        if (!existsSync(file)) {
          missing.push(`${locale}/${slug}.mdx`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('has no duplicate slugs', () => {
    expect(new Set(DOCS_SLUGS).size).toBe(DOCS_SLUGS.length);
  });

  it('has no empty sections', () => {
    for (const section of DOCS_SECTIONS) {
      expect(section.slugs.length).toBeGreaterThan(0);
    }
  });

  it('resolves a section for every slug', () => {
    for (const slug of DOCS_SLUGS) {
      expect(findSectionForSlug(slug)?.id).toBeDefined();
    }
  });

  it('recognises known slugs and rejects unknown ones', () => {
    expect(isKnownDocSlug('legal/terms')).toBe(true);
    expect(isKnownDocSlug('legal/nope')).toBe(false);
  });

  describe('pager', () => {
    it('walks the flat reading order across section boundaries', () => {
      const first = DOCS_SLUGS[0];
      const second = DOCS_SLUGS[1];
      const last = DOCS_SLUGS.at(-1) as string;

      expect(getNeighbours(first)).toEqual({
        previous: undefined,
        next: second,
      });
      expect(getNeighbours(second).previous).toBe(first);
      expect(getNeighbours(last).next).toBeUndefined();
    });

    it('returns nothing for an unknown slug', () => {
      expect(getNeighbours('not/a/page')).toEqual({});
    });
  });
});

describe('docs frontmatter', () => {
  it('stamps every page in every locale with a valid lastUpdated', () => {
    // Every doc page renders a revision stamp under its title, so a missing or
    // malformed date leaves a visible hole. The type in loader.ts says the
    // field is required, but MDX frontmatter is never type-checked against it
    // — this test is the only thing that actually enforces it.
    const bad: string[] = [];

    for (const locale of locales) {
      for (const slug of DOCS_SLUGS) {
        const file = path.join(CONTENT_ROOT, locale, `${slug}.mdx`);
        if (!existsSync(file)) continue;

        const source = readFileSync(file, 'utf8');
        const match = source.match(/^lastUpdated:\s*'(\d{4}-\d{2}-\d{2})'$/m);

        if (!match) {
          bad.push(`${locale}/${slug}.mdx`);
          continue;
        }

        const parsed = new Date(`${match[1]}T00:00:00Z`);
        if (Number.isNaN(parsed.getTime())) {
          bad.push(`${locale}/${slug}.mdx (unparseable: ${match[1]})`);
        }
      }
    }

    expect(bad).toEqual([]);
  });
});
