import { describe, expect, it } from 'vitest';
import { canonicalizeEmailForKey, normaliseEmail } from '@/lib/core/text/email';

describe('normaliseEmail', () => {
  it('lowercases, trims, and NFC-normalises', () => {
    expect(normaliseEmail('  Nguyen@Example.COM ')).toBe('nguyen@example.com');
    // Decomposed "ề" must collapse onto the composed form.
    expect(normaliseEmail('hòâng@x.vn')).toBe('hòâng@x.vn'.normalize('NFC'));
  });

  it('collapses spellings that would otherwise get separate limiter budgets', () => {
    expect(normaliseEmail('VICTIM@x.com')).toBe(normaliseEmail('victim@x.com'));
  });

  it('normalises a decomposed (NFD) local part onto its composed (NFC) form', () => {
    // The same address typed with a combining accent (NFD) vs a precomposed
    // one (NFC) must land on ONE key, or each spelling buys its own budget.
    const composed = 'nö@x.com';
    const decomposed = composed.normalize('NFD');
    expect(decomposed).not.toBe(composed); // the two byte strings really differ
    expect(normaliseEmail(decomposed)).toBe(normaliseEmail(composed));
  });
});

describe('canonicalizeEmailForKey', () => {
  it('strips plus-addressing on a known-alias domain, a free budget otherwise', () => {
    // Every one of these delivers to the same Gmail inbox, so every one of them
    // must land on the same rate-limit counter.
    for (const spelling of [
      'victim@gmail.com',
      'victim+1@gmail.com',
      'Victim+9999@GMail.COM',
      '  victim+anything at all@gmail.com  ',
    ]) {
      expect(canonicalizeEmailForKey(spelling)).toBe('victim@gmail.com');
    }
  });

  it('keeps plus-addressing DISTINCT on a domain with unverified alias semantics', () => {
    // example.com may provision `victim` and `victim+1` as separate mailboxes,
    // so collapsing them would let a flood at one exhaust the other's budget.
    expect(canonicalizeEmailForKey('victim+1@example.com')).toBe(
      'victim+1@example.com'
    );
    expect(canonicalizeEmailForKey('victim@example.com')).toBe(
      'victim@example.com'
    );
    expect(canonicalizeEmailForKey('victim+1@example.com')).not.toBe(
      canonicalizeEmailForKey('victim@example.com')
    );
  });

  it('strips dots for Google only, because only Google ignores them', () => {
    expect(canonicalizeEmailForKey('v.i.c.t.i.m@gmail.com')).toBe(
      'victim@gmail.com'
    );
    expect(canonicalizeEmailForKey('v.i.c.t.i.m+x@googlemail.com')).toBe(
      'victim@googlemail.com'
    );
    // Dots are significant here — collapsing them would merge two real people.
    expect(canonicalizeEmailForKey('a.b@fastmail.com')).toBe(
      'a.b@fastmail.com'
    );
  });

  it('leaves a value it cannot split alone rather than inventing one', () => {
    expect(canonicalizeEmailForKey('not-an-address')).toBe('not-an-address');
    expect(canonicalizeEmailForKey('@example.com')).toBe('@example.com');
    expect(canonicalizeEmailForKey('victim@')).toBe('victim@');
    // Nothing but a tag: there is no mailbox in front of the `+` to collapse
    // onto, so the tag is kept rather than producing a bare `@domain` key.
    expect(canonicalizeEmailForKey('+tag@example.com')).toBe(
      '+tag@example.com'
    );
  });
});
