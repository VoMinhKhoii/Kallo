import { describe, expect, it } from 'vitest';
import { groupByThreadDay } from '../thread-day';

const at = (iso: string) => ({ timestamp: iso, id: iso });

describe('groupByThreadDay', () => {
  it('runs consecutive same-day entries into one group, in order', () => {
    const days = groupByThreadDay([
      at('2026-10-04T12:00:00'),
      at('2026-10-04T08:00:00'),
      at('2026-10-03T20:00:00'),
    ]);

    expect(days.map((d) => d.items.length)).toEqual([2, 1]);
    expect(days[0].timestamp).toBe('2026-10-04T12:00:00');
    expect(days[1].items[0].id).toBe('2026-10-03T20:00:00');
  });

  it('returns no groups for an empty feed', () => {
    expect(groupByThreadDay([])).toEqual([]);
  });
});
