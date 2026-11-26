import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type FoodPage,
  medianMealKcal,
  pagesOf,
  relatedPages,
  similarCaloriePages,
} from '../pages';
import { FOOD_PAGE_LOCALES } from '../slugs';

// The boost list changes every week with Search Console, so these tests set
// their own: they check what the link lists do with a list, not this week's.
const striking = vi.hoisted(() => new Set<string>());
vi.mock('../search-boost', () => ({
  inStrikingDistance: (slug: string) => striking.has(slug),
}));

/** The six other-group pages nearest in median kcal, with no boost. */
function nearestSix(page: FoodPage): string[] {
  const target = medianMealKcal(page.capture);
  return pagesOf(page.locale)
    .filter((other) => other.group !== page.group)
    .sort(
      (a, b) =>
        Math.abs(medianMealKcal(a.capture) - target) -
        Math.abs(medianMealKcal(b.capture) - target)
    )
    .slice(0, 6)
    .map((p) => p.slug);
}

const slugsOf = (pages: FoodPage[]) => pages.map((p) => p.slug);

describe('search boost', () => {
  beforeEach(() => striking.clear());

  describe.each(FOOD_PAGE_LOCALES)('%s', (locale) => {
    it('lists boosted siblings first and keeps every sibling once', () => {
      for (const page of pagesOf(locale)) {
        const plain = slugsOf(relatedPages(page));
        if (plain.length < 2) continue;
        const boosted = plain.at(-1) as string;
        striking.add(boosted);
        const ordered = slugsOf(relatedPages(page));
        striking.clear();
        expect(ordered, page.slug).toEqual([boosted, ...plain.slice(0, -1)]);
      }
    });

    it('keeps the nearest three when no boosted page is near', () => {
      for (const page of pagesOf(locale)) {
        expect(slugsOf(similarCaloriePages(page)), page.slug).toEqual(
          nearestSix(page).slice(0, 3)
        );
      }
    });

    it('swaps a boosted page from places 4 to 6 into the third slot', () => {
      for (const page of pagesOf(locale)) {
        const nearest = nearestSix(page);
        if (nearest.length < 5) continue;
        striking.add(nearest[4]);
        const similar = slugsOf(similarCaloriePages(page));
        striking.clear();
        expect(similar, page.slug).toEqual([
          nearest[0],
          nearest[1],
          nearest[4],
        ]);
      }
    });

    it('does not swap when one of the nearest three is already boosted', () => {
      for (const page of pagesOf(locale)) {
        const nearest = nearestSix(page);
        striking.add(nearest[1]).add(nearest[4]);
        const similar = slugsOf(similarCaloriePages(page));
        striking.clear();
        expect(similar, page.slug).toEqual(nearest.slice(0, 3));
      }
    });
  });

  it('ignores a boosted slug that has no page', () => {
    striking.add('no-such-dish');
    for (const page of pagesOf('vi')) {
      expect(similarCaloriePages(page), page.slug).toHaveLength(3);
    }
  });
});
