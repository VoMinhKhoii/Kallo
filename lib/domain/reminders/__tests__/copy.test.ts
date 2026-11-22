import { describe, expect, it } from 'vitest';
import { reminderCopy } from '@/lib/domain/reminders/copy';
import { CHECKPOINTS } from '@/lib/domain/reminders/schedule';
import enActivity from '@/messages/en/activity.json';
import viActivity from '@/messages/vi/activity.json';

const at = (hour: number) => {
  const found = CHECKPOINTS.find((c) => c.hour === hour);
  if (!found) throw new Error(`no checkpoint ${hour}`);
  return found;
};

/** Consecutive local dates, across a month and a year boundary. */
function days(from: string, count: number): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10)
  );
}

const KEYS = ['yesterday', 'morning', 'afternoon', 'evening'] as const;
const CATALOGUE = { en: enActivity, vi: viActivity } as const;
const NAME = '{name}';

/** The catalogue line a sent text came from, with `{name}` filled back in. */
function slotOf(
  key: (typeof KEYS)[number],
  locale: 'en' | 'vi',
  text: string,
  name: string | null
): number {
  return CATALOGUE[locale].reminder[key].findIndex(
    (line) => (name ? line.replaceAll(NAME, name) : line) === text
  );
}

describe('reminderCopy', () => {
  it('takes one of the checkpoint’s lines, in the user’s language', () => {
    expect(
      slotOf(
        'morning',
        'en',
        reminderCopy(at(10), 'en', '2026-11-17', null),
        null
      )
    ).toBeGreaterThanOrEqual(0);
    expect(
      slotOf(
        'evening',
        'vi',
        reminderCopy(at(21), 'vi', '2026-11-17', 'Mai'),
        'Mai'
      )
    ).toBeGreaterThanOrEqual(0);
  });

  for (const name of [null, 'Mai']) {
    it(`gives the same line all day and a different one the next day (name: ${name})`, () => {
      for (const checkpoint of CHECKPOINTS) {
        for (const locale of ['en', 'vi'] as const) {
          const seq = days('2026-12-20', 40).map((d) =>
            reminderCopy(checkpoint, locale, d, name)
          );
          for (let i = 1; i < seq.length; i++) {
            expect(seq[i], `${checkpoint.copyKey} ${locale} day ${i}`).not.toBe(
              seq[i - 1]
            );
          }
          // Every line it may use comes round within one cycle.
          const usable = CATALOGUE[locale].reminder[checkpoint.copyKey].filter(
            (_line, slot) =>
              name !== null ||
              !(
                enActivity.reminder[checkpoint.copyKey][slot].includes(NAME) ||
                viActivity.reminder[checkpoint.copyKey][slot].includes(NAME)
              )
          );
          expect(new Set(seq).size).toBe(usable.length);
          expect(usable.length).toBeGreaterThan(1);
        }
      }
    });
  }

  it('says the name where a line has one, and never leaves the placeholder', () => {
    const seq = days('2026-12-20', 40).flatMap((d) =>
      CHECKPOINTS.flatMap((c) =>
        (['en', 'vi'] as const).map((l) =>
          reminderCopy(c, l, d, '  Minh  Anh ')
        )
      )
    );
    expect(seq.some((text) => text.includes('Minh Anh'))).toBe(true);
    expect(seq.every((text) => !text.includes(NAME))).toBe(true);
  });

  it('skips the named lines for someone with no name, in both languages', () => {
    for (const blank of [null, '', '   ']) {
      for (const d of days('2026-12-20', 40)) {
        for (const c of CHECKPOINTS) {
          for (const l of ['en', 'vi'] as const) {
            expect(reminderCopy(c, l, d, blank)).not.toContain(NAME);
          }
        }
      }
    }
  });

  it('pairs each English line with the Vietnamese line at the same place', () => {
    for (const key of KEYS) {
      expect(viActivity.reminder[key]).toHaveLength(
        enActivity.reminder[key].length
      );
    }
    for (const name of [null, 'Mai']) {
      for (const d of days('2027-03-01', 12)) {
        for (const c of CHECKPOINTS) {
          expect(
            slotOf(c.copyKey, 'vi', reminderCopy(c, 'vi', d, name), name)
          ).toBe(slotOf(c.copyKey, 'en', reminderCopy(c, 'en', d, name), name));
        }
      }
    }
  });

  it('never quotes a number placeholder: the lock screen is public', () => {
    for (const locale of [enActivity, viActivity]) {
      for (const lines of Object.values(locale.reminder)) {
        for (const line of lines) {
          expect(line.replaceAll(NAME, '')).not.toMatch(/[{}[\]]|kcal/);
        }
      }
    }
  });

  it('gives each checkpoint its category, and the close button only to 08:00 and 21:00', () => {
    expect(
      CHECKPOINTS.map((c) => [c.hour, c.category, c.closesDay, c.type])
    ).toEqual([
      [8, 'REMINDER_YESTERDAY', true, 'reminder.yesterday'],
      [10, 'REMINDER_LOG', false, 'reminder.checkpoint'],
      [15, 'REMINDER_LOG', false, 'reminder.checkpoint'],
      [21, 'REMINDER_EVENING', true, 'reminder.checkpoint'],
    ]);
  });
});
