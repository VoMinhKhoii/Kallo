import { describe, expect, it } from 'vitest';
import {
  FOOD_PAGES,
  pagesOf,
  relatedPages,
  similarCaloriePages,
} from '../pages';
import { inStrikingDistance, STRIKING_SLUGS } from '../search-boost';
import { FOOD_PAGE_LOCALES } from '../slugs';

describe('search boost', () => {
  it('names only food pages that exist', () => {
    for (const slug of STRIKING_SLUGS) {
      expect(FOOD_PAGES[slug as keyof typeof FOOD_PAGES], slug).toBeDefined();
    }
  });

  describe.each(FOOD_PAGE_LOCALES)('%s', (locale) => {
    it('lists striking-distance siblings before the rest of the group', () => {
      for (const page of pagesOf(locale)) {
        const flags = relatedPages(page).map((p) => inStrikingDistance(p.slug));
        // once a non-striking page appears, no striking page follows it
        expect(
          flags.slice(flags.indexOf(false) + 1 || flags.length)
        ).not.toContain(true);
      }
    });

    it('keeps similar-calorie links to three, at most one swapped in', () => {
      for (const page of pagesOf(locale)) {
        const similar = similarCaloriePages(page);
        expect(similar, page.slug).toHaveLength(3);
        expect(new Set(similar.map((p) => p.slug)).size).toBe(3);
      }
    });
  });

  it('gives every striking-distance page more inbound links than its group alone', () => {
    for (const slug of STRIKING_SLUGS) {
      const target = FOOD_PAGES[slug as keyof typeof FOOD_PAGES];
      if (!target) continue;
      const fromOtherGroups = pagesOf(target.locale).filter(
        (page) =>
          page.group !== target.group &&
          similarCaloriePages(page).some((p) => p.slug === slug)
      );
      expect(fromOtherGroups.length, slug).toBeGreaterThan(0);
    }
  });
});
