import { type Locale, type Namespace, namespaces } from './config';

/**
 * Loads a locale's message catalogue and merges the namespaces back into the
 * single object next-intl expects.
 *
 * Its own file rather than a few lines inside `request.ts` so it can be tested
 * without next-intl in the way: `request.ts` is mocked wholesale in the test
 * setup (`vitest.setup.ts` stubs `next-intl`, `next-intl/server` and
 * `@/i18n/navigation`), and this is the half that has to actually run. A
 * broken merge does not fail to compile — it paints raw key paths across the
 * app at render time.
 */

/**
 * One entry per locale so the bundler sees a literal directory.
 *
 * The namespace stays a variable — that is the point of the split — but the
 * locale must not be, or every locale's messages land in the same chunk. Two
 * lines is the price of keeping vi out of an en response.
 */
const loaders: Record<
  Locale,
  (ns: Namespace) => Promise<{ default: unknown }>
> = {
  en: (ns) => import(`../messages/en/${ns}.json`),
  vi: (ns) => import(`../messages/vi/${ns}.json`),
};

export async function loadMessages(
  locale: Locale
): Promise<Record<Namespace, unknown>> {
  const load = loaders[locale];
  const loaded = await Promise.all(
    namespaces.map(async (ns) => [ns, (await load(ns)).default] as const)
  );
  return Object.fromEntries(loaded) as Record<Namespace, unknown>;
}
