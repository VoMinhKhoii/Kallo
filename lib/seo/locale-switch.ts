import {
  ALTERNATIVES_LOCALE,
  ALTERNATIVES_PREFIX,
} from '@/lib/seo/alternatives/slugs';
import { switchedFoodPath } from '@/lib/seo/food-pages/slugs';

/** Folders whose pages exist in one locale only, with that locale. */
const SINGLE_LOCALE_PREFIXES = [
  { prefix: ALTERNATIVES_PREFIX, locale: ALTERNATIVES_LOCALE },
];

/**
 * Where a locale switch should land from `pathname` (locale-relative): the
 * same page in `nextLocale` when it has one, otherwise the nearest page that
 * exists. A page in a single-locale folder leaves for the home page; a dish
 * with no twin leaves for that locale's food hub.
 */
export function localeSwitchPath(pathname: string, nextLocale: string): string {
  const singleLocale = SINGLE_LOCALE_PREFIXES.some(
    ({ prefix, locale }) =>
      locale !== nextLocale && pathname.startsWith(`${prefix}/`)
  );
  return singleLocale ? '/' : switchedFoodPath(pathname, nextLocale);
}
