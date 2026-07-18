import { describe, expect, it } from 'vitest';
import {
  decodeSharedMealCursor,
  encodeSharedMealCursor,
} from '@/lib/groups/feed/cursor';

const ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('shared meal cursors', () => {
  it('round-trips a full-precision database timestamp opaquely', () => {
    const cursor = { ts: '2026-07-18 12:34:56.123456+00', id: ID };

    expect(decodeSharedMealCursor(encodeSharedMealCursor(cursor))).toEqual(
      cursor
    );
  });

  it('keeps accepting a legacy ISO timestamp with the max id sentinel', () => {
    expect(decodeSharedMealCursor('2026-07-18T12:34:56.123Z')).toEqual({
      ts: '2026-07-18T12:34:56.123Z',
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    });
  });

  it('rejects malformed opaque cursors', () => {
    expect(() => decodeSharedMealCursor('not-a-cursor')).toThrow(
      'Con trỏ dòng thức ăn không hợp lệ.'
    );
  });
});
