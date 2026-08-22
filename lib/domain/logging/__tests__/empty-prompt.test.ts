import { describe, expect, it } from 'vitest';
import {
  bucketForHour,
  drawEmptyPromptKey,
  EMPTY_PROMPT_BUCKETS,
} from '@/lib/domain/logging/empty-prompt';
import en from '@/messages/en/logging.json';
import vi from '@/messages/vi/logging.json';

describe('the empty-day prompt', () => {
  it('runs the day through its buckets in order', () => {
    expect(bucketForHour(5)).toBe('morning');
    expect(bucketForHour(10)).toBe('morning');
    expect(bucketForHour(11)).toBe('lunch');
    expect(bucketForHour(14)).toBe('lunch');
    expect(bucketForHour(15)).toBe('afternoon');
    expect(bucketForHour(17)).toBe('afternoon');
    expect(bucketForHour(18)).toBe('evening');
    expect(bucketForHour(21)).toBe('evening');
  });

  it('wraps late night around midnight', () => {
    // The one bucket that is not a contiguous range: 22:00 through to the
    // start of breakfast.
    expect(bucketForHour(22)).toBe('lateNight');
    expect(bucketForHour(23)).toBe('lateNight');
    expect(bucketForHour(0)).toBe('lateNight');
    expect(bucketForHour(4)).toBe('lateNight');
  });

  it('draws within the bucket, never off the end', () => {
    // Math.random() returns [0, 1), so 0.999… must still land on the last
    // phrasing rather than one past it.
    expect(drawEmptyPromptKey(12, () => 0)).toBe('lunch1');
    expect(drawEmptyPromptKey(12, () => 0.999999)).toBe('lunch3');
  });

  it('every phrasing it can draw exists in both locales, named and not', () => {
    // The prompt is the first thing on an empty day. A key with no translation
    // renders as a raw key path right where the app is meant to sound human.
    for (const [bucket, count] of Object.entries(EMPTY_PROMPT_BUCKETS)) {
      for (let n = 1; n <= count; n++) {
        for (const [locale, messages] of [
          ['en', en],
          ['vi', vi],
        ] as const) {
          const prompts = (
            messages as unknown as {
              emptyState: Record<string, string>;
            }
          ).emptyState;
          expect(
            prompts[`${bucket}${n}`],
            `${locale} ${bucket}${n}`
          ).toBeTruthy();
          expect(
            prompts[`${bucket}${n}Named`],
            `${locale} ${bucket}${n}Named`
          ).toContain('{name}');
        }
      }
    }
  });
});
