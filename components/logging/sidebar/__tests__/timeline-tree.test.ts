import { describe, expect, it } from 'vitest';
import { buildTimelineTree } from '../timeline-tree';

// September 2026 starts on a Tuesday, so `weekOfMonth` reads Sep 1-6 as the
// partial week 1, then 7-13, 14-20, 21-27 and 28-30. That is the shape the
// live sidebar shows, which makes it the useful month to pin tests to.
const TODAY = '2026-09-22';

function daysOf(dates: string[], today = TODAY, selectedDate = TODAY) {
  return buildTimelineTree({ dates, today, selectedDate })
    .flatMap((month) => month.weeks)
    .flatMap((week) => week.days);
}

describe('buildTimelineTree', () => {
  it('fills a covered month with every day up to today, not just logged ones', () => {
    const days = daysOf(['2026-09-16']);

    // One log in week 3 pulls in the whole month before it.
    expect(days).toContain('2026-09-01');
    expect(days).toContain('2026-09-15');
    expect(days).toContain('2026-09-17');
    expect(days).toContain('2026-09-22');
    expect(days).toHaveLength(22);
  });

  it('drops days after today', () => {
    const days = daysOf(['2026-09-16']);

    expect(days).not.toContain('2026-09-23');
    expect(days).not.toContain('2026-09-30');
  });

  it('never hides a day that holds a log, even past today', () => {
    // The browser's `today` and the server's tz-stamped dates can disagree by a
    // few hours around midnight. A real meal outranks the clamp.
    const days = daysOf(['2026-09-24']);

    expect(days).toContain('2026-09-24');
    expect(days).not.toContain('2026-09-23');
  });

  it('keeps a future selected date so it still has a row', () => {
    const days = daysOf([], TODAY, '2026-09-26');

    expect(days).toContain('2026-09-26');
    expect(days).not.toContain('2026-09-25');
    expect(days).not.toContain('2026-09-27');
  });

  it('buckets the partial first and last weeks correctly', () => {
    const august = buildTimelineTree({
      dates: ['2026-08-10'],
      today: TODAY,
      selectedDate: TODAY,
    }).find((month) => month.month === 8);

    // August 2026 starts on a Saturday: week 1 is the 1st-2nd alone. Days come
    // out ascending — the order the sidebar renders them in.
    expect(august?.weeks[0].days).toEqual(['2026-08-01', '2026-08-02']);
    // ...and the month ends mid-week on the 31st.
    expect(august?.weeks.at(-1)?.days).toEqual(['2026-08-31']);
  });

  it('covers a month that only holds the selected date', () => {
    const months = buildTimelineTree({
      dates: [],
      today: TODAY,
      selectedDate: '2026-06-04',
    });

    expect(months.map((m) => m.month)).toEqual([9, 6]);
  });

  it('orders months newest first and weeks oldest first', () => {
    const months = buildTimelineTree({
      dates: ['2026-07-03', '2026-09-16'],
      today: TODAY,
      selectedDate: TODAY,
    });

    expect(months.map((m) => m.month)).toEqual([9, 7]);
    expect(months[0].weeks.map((w) => w.weekNumber)).toEqual([1, 2, 3, 4]);
  });

  it('emits week keys that match getSelectedWeekKey', () => {
    const months = buildTimelineTree({
      dates: ['2026-09-16'],
      today: TODAY,
      selectedDate: TODAY,
    });

    expect(months[0].key).toBe('09-2026');
    expect(months[0].weeks.map((w) => w.key)).toEqual([
      '09-2026-w1',
      '09-2026-w2',
      '09-2026-w3',
      '09-2026-w4',
    ]);
  });
});
