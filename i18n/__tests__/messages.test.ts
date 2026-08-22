import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { locales, namespaces } from '../config';
import { loadMessages } from '../messages';

const DIR = path.resolve(__dirname, '../../messages');

function read(locale: string, namespace: string): unknown {
  return JSON.parse(
    readFileSync(path.join(DIR, locale, `${namespace}.json`), 'utf8')
  );
}

/** Every leaf, as a dotted path. Arrays are leaves — order is their content. */
function keyPaths(node: unknown, prefix = ''): string[] {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    return [prefix];
  }
  return Object.entries(node).flatMap(([key, value]) =>
    keyPaths(value, prefix ? `${prefix}.${key}` : key)
  );
}

/**
 * The one place en and vi are allowed to differ, and why.
 *
 * The "understanding" section on the landing page compares two real pipeline
 * runs per category, and the two locales eat different food: the English `fat`
 * pair has a side of greens where the Vietnamese one has canh, and English
 * `oil` is a burger and fries where Vietnamese is bún đậu. The dish ids under
 * `items` therefore differ by design — they name the rows in
 * `components/landing-page/understanding/comparisons-{en,vi}.ts`, which are
 * captured fixtures, not translations of each other.
 *
 * Nothing else may diverge. If a new path needs adding here, it is almost
 * certainly a missing translation instead.
 */
const CUISINE_SPECIFIC = /^landing\.understanding\.categories\.[^.]+\.items\./;

describe('the split message catalogue', () => {
  it('has exactly the namespace files the loader imports, per locale', () => {
    // `i18n/request.ts` imports `namespaces` by name, so a file nobody listed
    // never loads and a name with no file is a build error. Both directions.
    for (const locale of locales) {
      const onDisk = readdirSync(path.join(DIR, locale))
        .filter((name) => name.endsWith('.json'))
        .map((name) => name.replace(/\.json$/, ''))
        .sort();
      expect(onDisk, locale).toEqual([...namespaces].sort());
    }
  });

  it.each(
    locales
  )('merges %s back into one message object at request time', async (locale) => {
    // The only check that exercises the loader itself. next-intl resolves
    // keys at RENDER time, so a broken merge type-checks, builds, and then
    // paints raw key paths across the app — this catches it in CI instead.
    // loadMessages rather than request.ts's getRequestConfig: vitest.setup
    // stubs next-intl wholesale, so the config wrapper cannot run here — the
    // merge is the half that has to, which is why it lives in its own module.
    const messages = await loadMessages(locale);

    const expected = Object.fromEntries(
      namespaces.map((ns) => [ns, read(locale, ns)])
    );
    expect(messages).toEqual(expected);
    expect(Object.keys(messages)).toEqual([...namespaces]);
  });

  it('keeps en and vi on the same key set', () => {
    // The drift guard. A 1800-line single file hid a one-key difference
    // between the locales; per-namespace comparison names the namespace.
    for (const namespace of namespaces) {
      const en = keyPaths(read('en', namespace), namespace);
      const vi = keyPaths(read('vi', namespace), namespace);
      const allowed = (key: string) => !CUISINE_SPECIFIC.test(key);

      expect(
        en.filter(allowed).filter((key) => !vi.includes(key)),
        `${namespace}: keys in en with no vi translation`
      ).toEqual([]);
      expect(
        vi.filter(allowed).filter((key) => !en.includes(key)),
        `${namespace}: keys in vi with no en original`
      ).toEqual([]);
    }
  });
});
