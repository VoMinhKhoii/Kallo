import type { FoodSlugOf } from './slugs';

/**
 * The meals every page's footer links, per locale. A crawler finds a new URL
 * through a page it already reads, and the footer is on all of them, so these
 * are the dishes people search most that Google had not found yet (2026-11-07).
 * Swap one out once it ranks; the list stays this short on purpose.
 */
export const FOOTER_MEALS: { [L in 'en' | 'vi']: FoodSlugOf<L>[] } = {
  en: [
    'lasagna',
    'mac-and-cheese',
    'butter-chicken',
    'pho',
    'fried-chicken',
    'fish-and-chips',
    'bibimbap',
    'chicken-alfredo',
  ],
  vi: [
    'bun-bo-hue',
    'bun-cha',
    'com-tam-suon',
    'banh-mi-thit',
    'banh-xeo',
    'tra-sua-tran-chau',
    'ca-phe-sua-da',
    'xoi',
  ],
};
