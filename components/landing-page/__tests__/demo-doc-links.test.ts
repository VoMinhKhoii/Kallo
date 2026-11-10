import { describe, expect, it } from 'vitest';
import { isKnownDocSlug } from '@/lib/domain/docs/navigation';
import { ROWS } from '../showcase/beyond-macros';
import { PHONES } from '../showcase/phone-trio';
import { WAYS } from '../showcase/typing-alternatives';

describe('landing demo links', () => {
  // The demos link into the docs by slug, outside the docs registry's own
  // types, so a renamed or misspelled slug would be a silent 404 on the page
  // most visitors land on.
  it('points every demo at a docs page that exists', () => {
    const slugs = [
      ...PHONES.map((phone) => phone.doc),
      ...WAYS.map((way) => way.doc),
      ...ROWS.flatMap((row) => (row.doc ? [row.doc] : [])),
    ];

    expect(slugs.filter((slug) => !isKnownDocSlug(slug))).toEqual([]);
    expect(slugs).toHaveLength(8);
  });
});
