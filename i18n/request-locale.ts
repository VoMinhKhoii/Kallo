import * as rootParams from 'next/root-params';
import { defaultLocale, type Locale, locales } from './config';

/**
 * Which locale a server render uses, for `i18n/request.ts`.
 *
 * The `[locale]` segment is the app's root param, so `next/root-params` hands
 * it to any Server Component without `params` or the old `setRequestLocale`
 * call — and, unlike the header next-intl used to read, it is known while the
 * static shell is prerendered, so translated pages stay static under Cache
 * Components.
 *
 * Next 16.3 does not support root params in Server Actions or Route Handlers
 * yet and throws synchronously there. Those callers either pass an explicit
 * locale (`getTranslations({ locale })`) or fall back to the locale header the
 * proxy's next-intl step sets — reading it makes the caller request-time, which
 * an action or a handler already is.
 */

interface ResolveRequestLocaleArgs {
  /** An explicit `locale` passed to `getTranslations({ locale })` etc. */
  override: string | undefined;
  /**
   * next-intl's header-based locale. A thunk because reading it reads
   * `headers()`, which must not happen on a prerendered route.
   */
  readRequestLocale: () => Promise<string | undefined>;
}

function readLocaleRootParam(): Promise<string | undefined> | undefined {
  try {
    return rootParams.locale();
  } catch {
    // Server Action or Route Handler: no root params there (see above).
    return undefined;
  }
}

export async function resolveRequestLocale({
  override,
  readRequestLocale,
}: ResolveRequestLocaleArgs): Promise<Locale> {
  const candidate =
    override ?? (await readLocaleRootParam()) ?? (await readRequestLocale());
  // An unknown segment (`/xx/...`) still renders something: the locale layout
  // calls notFound() for it, and that page needs messages too.
  return isLocale(candidate) ? candidate : defaultLocale;
}

function isLocale(value: string | undefined): value is Locale {
  return (locales as readonly (string | undefined)[]).includes(value);
}
