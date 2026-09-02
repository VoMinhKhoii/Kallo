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
});

describe('canonicalizeEmailForKey', () => {
  it('strips plus-addressing, which is a free budget otherwise', () => {
    // Every one of these delivers to the same inbox, so every one of them must
    // land on the same rate-limit counter.
    for (const spelling of [
      'victim@example.com',
      'victim+1@example.com',
      'Victim+9999@Example.COM',
      '  victim+anything at all@example.com  ',
    ]) {
      expect(canonicalizeEmailForKey(spelling)).toBe('victim@example.com');
    }
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
