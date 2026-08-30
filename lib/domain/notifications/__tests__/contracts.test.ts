import { describe, expect, it } from 'vitest';
import {
  markReadBodySchema,
  markSeenBodySchema,
  notificationsListQuerySchema,
} from '@/lib/domain/notifications/contracts';

const ID = 'd3bbef22-cf3e-4bb1-9e90-9eecef613d44';

describe('notificationsListQuerySchema', () => {
  it('defaults the page size and leaves the cursor optional', () => {
    expect(notificationsListQuerySchema.parse({})).toEqual({ limit: 25 });
  });

  it('coerces the query-string limit', () => {
    expect(notificationsListQuerySchema.parse({ limit: '10' }).limit).toBe(10);
  });

  it('caps the page size at 50', () => {
    expect(() => notificationsListQuerySchema.parse({ limit: 51 })).toThrow();
    expect(() => notificationsListQuerySchema.parse({ limit: 0 })).toThrow();
    expect(() => notificationsListQuerySchema.parse({ limit: 2.5 })).toThrow();
  });

  it('keeps an opaque cursor verbatim', () => {
    const before = 'eyJ0cyI6IjIwMjYifQ';
    expect(notificationsListQuerySchema.parse({ before }).before).toBe(before);
  });
});

describe('markSeenBodySchema', () => {
  it('requires an ISO instant', () => {
    expect(
      markSeenBodySchema.parse({ before: '2026-08-01T10:00:00.000Z' }).before
    ).toBe('2026-08-01T10:00:00.000Z');
    expect(() => markSeenBodySchema.parse({ before: '2026-08-01' })).toThrow();
    expect(() => markSeenBodySchema.parse({})).toThrow();
  });
});

describe('markReadBodySchema', () => {
  it('accepts a bounded list of uuids and lowercases them', () => {
    expect(markReadBodySchema.parse({ ids: [ID.toUpperCase()] })).toEqual({
      ids: [ID],
    });
  });

  it('rejects an empty list, a too-long list and non-uuids', () => {
    expect(() => markReadBodySchema.parse({ ids: [] })).toThrow();
    expect(() =>
      markReadBodySchema.parse({ ids: new Array(51).fill(ID) })
    ).toThrow();
    expect(() => markReadBodySchema.parse({ ids: ['nope'] })).toThrow();
  });
});
