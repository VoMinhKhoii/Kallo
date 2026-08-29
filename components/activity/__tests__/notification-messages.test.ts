/**
 * The aggregate Activity rows, rendered through the REAL message catalogue.
 *
 * Every other Activity test runs against the global next-intl mock, which
 * echoes the key back — so template SELECTION is covered, but nothing ever
 * rendered the sentence. That is how "QA Mai B and 1 others logged your meal"
 * reached production: `messageValues` passes `actorCount - 1`, which is 1 for
 * the two-actor case, and the English strings were flat.
 *
 * `vi.unmock` restores the real translator for this file only.
 */
import { describe, expect, it, vi } from 'vitest';

vi.unmock('next-intl');

import { createTranslator } from 'next-intl';
import enMessages from '@/messages/en/activity.json';
import viMessages from '@/messages/vi/activity.json';

/** The wire types that collapse into "X and N others" — the catalogue nests
 *  them exactly as the dotted type reads, so the type IS the key path. */
type AggregateKey = 'share.reaction' | 'share.reply' | 'share.logged';

const AGGREGATE_KEYS: AggregateKey[] = [
  'share.reaction',
  'share.reply',
  'share.logged',
];

/** The rendered sentence, with the `<b>` wrapper reduced to plain text. */
function renderAggregate(
  messages: typeof enMessages,
  locale: string,
  key: AggregateKey,
  count: number
): string {
  const t = createTranslator({
    locale,
    namespace: 'activity',
    messages: { activity: messages },
  });
  return t.markup(
    `row.${key}.other` as never,
    {
      name: 'Mai',
      count,
      b: (chunks: string) => chunks,
    } as never
  );
}

describe('activity aggregate copy', () => {
  it.each(
    AGGREGATE_KEYS
  )('inflects the English %s aggregate for a single other actor', (key) => {
    const line = renderAggregate(enMessages, 'en', key, 1);
    expect(line).toContain('and 1 other ');
    expect(line).not.toContain('1 others');
  });

  it.each(
    AGGREGATE_KEYS
  )('keeps the plural English %s aggregate for several other actors', (key) => {
    expect(renderAggregate(enMessages, 'en', key, 3)).toContain(
      'and 3 others '
    );
  });

  it('names the actor and keeps the per-type verb', () => {
    expect(renderAggregate(enMessages, 'en', 'share.logged', 1)).toBe(
      'Mai and 1 other logged your meal'
    );
    expect(renderAggregate(enMessages, 'en', 'share.reaction', 2)).toBe(
      'Mai and 2 others reacted to your meal'
    );
  });

  // Vietnamese has no plural inflection: "1 người khác" and "3 người khác"
  // are both correct, so those strings stay flat.
  it.each(
    AGGREGATE_KEYS
  )('reads naturally in Vietnamese at any count for %s', (key) => {
    expect(renderAggregate(viMessages, 'vi', key, 1)).toContain(
      'và 1 người khác'
    );
    expect(renderAggregate(viMessages, 'vi', key, 3)).toContain(
      'và 3 người khác'
    );
  });
});
