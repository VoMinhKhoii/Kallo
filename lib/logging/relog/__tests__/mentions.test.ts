import { describe, expect, it } from 'vitest';
import {
  buildMentionSegments,
  insertMention,
  type RelogMention,
  reconcileMentions,
  stripMentions,
} from '@/lib/logging/relog/mentions';
import { parseSlashToken } from '@/lib/logging/relog/relog';

const mention = (label: string, start: number): RelogMention => ({
  stageId: `stage-${label}-${start}`,
  ref: { kind: 'meal', sourceMealId: '11111111-1111-4111-8111-111111111111' },
  label,
  partCount: 1,
  summary: {
    totalGrams: null,
    caloriesKcal: null,
    proteinG: null,
    carbohydrateG: null,
    fatG: null,
  },
  start,
});

const token = (value: string, caret = value.length) => {
  const parsed = parseSlashToken(value, caret);
  if (!parsed) throw new Error(`no token in ${JSON.stringify(value)}`);
  return parsed;
};

describe('insertMention', () => {
  it('replaces the token with the label and trails a space', () => {
    const value = '/pho';
    expect(insertMention(value, token(value), 'Phở bò')).toEqual({
      value: 'Phở bò ',
      caret: 7,
      start: 0,
    });
  });

  it('keeps the text around the token', () => {
    const value = 'xem /pho rồi';
    // Caret sits at the end of "/pho"; the trailing text already starts with a
    // space, so no second one is added.
    const result = insertMention(value, token(value, 8), 'Phở bò');
    expect(result.value).toBe('xem Phở bò rồi');
    expect(result.start).toBe(4);
    expect(result.caret).toBe(10);
  });

  it('does not double the separator when a space already follows', () => {
    const value = '/pho x';
    const result = insertMention(value, token(value, 4), 'Phở bò');
    expect(result.value).toBe('Phở bò x');
    expect(result.caret).toBe(6);
  });
});

describe('reconcileMentions', () => {
  it('keeps a mention whose text is untouched', () => {
    expect(reconcileMentions('Phở bò ', [mention('Phở bò', 0)])).toHaveLength(
      1
    );
  });

  it('re-locates a mention after text is inserted before it', () => {
    const [found] = reconcileMentions('xem Phở bò ', [mention('Phở bò', 0)]);
    expect(found.start).toBe(4);
  });

  it('drops a mention whose label was edited', () => {
    // The guard that matters: a half-deleted name must not still log a dish.
    expect(reconcileMentions('Ph ', [mention('Phở bò', 0)])).toEqual([]);
  });

  it('drops a mention whose text was removed entirely', () => {
    expect(reconcileMentions('', [mention('Phở bò', 0)])).toEqual([]);
  });

  it('keeps duplicate picks distinct rather than collapsing them', () => {
    const value = 'Cà phê Cà phê ';
    const found = reconcileMentions(value, [
      mention('Cà phê', 0),
      mention('Cà phê', 7),
    ]);
    expect(found.map((m) => m.start)).toEqual([0, 7]);
  });

  it('drops only the deleted one of two identical mentions', () => {
    const found = reconcileMentions('Cà phê ', [
      mention('Cà phê', 0),
      mention('Cà phê', 7),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0].start).toBe(0);
  });

  it('preserves order across a reflow', () => {
    const found = reconcileMentions('a Trà đá b Phở bò c', [
      mention('Trà đá', 0),
      mention('Phở bò', 6),
    ]);
    expect(found.map((m) => m.label)).toEqual(['Trà đá', 'Phở bò']);
    expect(found.map((m) => m.start)).toEqual([2, 11]);
  });

  // The cursor only moves forward, so a caller that hands over a pick made
  // EARLIER in the sentence than one already staged would have it walked past
  // and dropped — the reference gone while its label sits in the text, headed
  // for the AI as prose. Sorting inside the walk is what makes callers safe.
  it('keeps a mention the caller listed out of composer order', () => {
    const found = reconcileMentions('Cà phê Phở bò', [
      mention('Phở bò', 7),
      mention('Cà phê', 0),
    ]);
    expect(found.map((m) => m.label)).toEqual(['Cà phê', 'Phở bò']);
    expect(found.map((m) => m.start)).toEqual([0, 7]);
  });

  // A pick spliced in exactly where another one started: the splice is what
  // pushed the old one right, so the newcomer — listed first — takes the slot.
  it('breaks an offset tie in favour of the earlier-listed mention', () => {
    const found = reconcileMentions('Cà phê Phở bò', [
      mention('Cà phê', 0),
      mention('Phở bò', 0),
    ]);
    expect(found.map((m) => m.label)).toEqual(['Cà phê', 'Phở bò']);
  });
});

describe('stripMentions', () => {
  it('removes the mention text and trims the leftovers', () => {
    expect(stripMentions('Phở bò ', [mention('Phở bò', 0)])).toBe('');
  });

  it('keeps free text the user typed around it', () => {
    expect(stripMentions('Phở bò thêm rau', [mention('Phở bò', 0)])).toBe(
      'thêm rau'
    );
  });

  it('removes several mentions without corrupting the offsets', () => {
    const value = 'Phở bò và Trà đá nữa';
    const result = stripMentions(value, [
      mention('Phở bò', 0),
      mention('Trà đá', 10),
    ]);
    expect(result).toBe('và nữa');
  });

  it('does not rewrite a surviving mention that contains a double space', () => {
    // A `meal` candidate's label is `raw_input` — free user text, so a double
    // space is reachable. Collapsing whitespace across the WHOLE value (what
    // this used to do) rewrote the survivor's label, and the next reconcile
    // then dropped its reference while its staged row stayed on screen.
    const kept = 'phở bò  với trà đá';
    const value = `${kept} Phở gà `;
    const survivor = mention(kept, 0);

    const out = stripMentions(value, [mention('Phở gà', kept.length + 1)]);

    expect(out).toContain(kept);
    expect(reconcileMentions(out, [survivor])).toHaveLength(1);
  });

  it('still collapses the gap the removal itself left behind', () => {
    expect(stripMentions('sáng Phở bò nay', [mention('Phở bò', 5)])).toBe(
      'sáng nay'
    );
  });
});

describe('buildMentionSegments', () => {
  it('marks the mention run and leaves the rest plain', () => {
    expect(
      buildMentionSegments('xem Phở bò ok', [mention('Phở bò', 4)])
    ).toEqual([
      { text: 'xem ', isMention: false },
      { text: 'Phở bò', isMention: true },
      { text: ' ok', isMention: false },
    ]);
  });

  it('reproduces the value exactly — the overlay depends on it', () => {
    const value = 'a Phở bò b Trà đá c';
    const segments = buildMentionSegments(value, [
      mention('Phở bò', 2),
      mention('Trà đá', 11),
    ]);
    expect(segments.map((s) => s.text).join('')).toBe(value);
  });

  it('handles a value that is nothing but a mention', () => {
    expect(buildMentionSegments('Phở bò', [mention('Phở bò', 0)])).toEqual([
      { text: 'Phở bò', isMention: true },
    ]);
  });

  it('returns one plain run when there are no mentions', () => {
    expect(buildMentionSegments('phở bò', [])).toEqual([
      { text: 'phở bò', isMention: false },
    ]);
  });
});
