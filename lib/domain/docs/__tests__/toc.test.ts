import GithubSlugger from 'github-slugger';
import { describe, expect, it } from 'vitest';
import { getToc } from '@/lib/domain/docs/toc';

describe('getToc', () => {
  it('extracts h2 and h3 from a real page', async () => {
    const toc = await getToc('vi', 'estimates/how-it-works');

    expect(toc.length).toBeGreaterThan(0);
    for (const entry of toc) {
      expect([2, 3]).toContain(entry.depth);
      expect(entry.text).not.toMatch(/^#/);
      expect(entry.id).not.toBe('');
    }
  });

  it('produces ids that match what rehype-slug generates', async () => {
    // Both sides use github-slugger, so this pins the contract: if the two ever
    // diverge, every anchor link and the whole scroll-spy rail break silently.
    const toc = await getToc('vi', 'estimates/how-it-works');
    const slugger = new GithubSlugger();

    for (const entry of toc) {
      slugger.reset();
      expect(entry.id).toBe(slugger.slug(entry.text));
    }
  });

  it('keeps Vietnamese diacritics meaningful in ids', () => {
    // bò / bơ / bổ must not collapse into one id, or two headings on the same
    // page would fight over the same anchor.
    const slugger = new GithubSlugger();
    const ids = ['Thịt bò', 'Bơ lạt', 'Món bổ'].map((text) => {
      slugger.reset();
      return slugger.slug(text);
    });

    expect(new Set(ids).size).toBe(3);
  });

  it('excludes the frontmatter block', async () => {
    const toc = await getToc('vi', 'legal/terms');

    expect(toc.some((entry) => entry.text.includes('title:'))).toBe(false);
  });

  it('returns an empty list for a page that does not exist', async () => {
    expect(await getToc('vi', 'no/such/page')).toEqual([]);
  });
});
