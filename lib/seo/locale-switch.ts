import { switchedAlternativePath } from '@/lib/seo/alternatives/slugs';
import { switchedFoodPath } from '@/lib/seo/food-pages/slugs';

/**
 * Where a locale switch should land from `pathname` (locale-relative): the
 * same page in `nextLocale` when it has one, otherwise the nearest page that
 * exists (a food page's hub, the home page for an English-only page).
 */
export function localeSwitchPath(pathname: string, nextLocale: string): string {
  return switchedAlternativePath(
    switchedFoodPath(pathname, nextLocale),
    nextLocale
  );
}
