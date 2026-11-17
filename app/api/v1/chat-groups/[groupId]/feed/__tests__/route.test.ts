import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listGroupMealFeed } from '@/lib/actions/chat-groups/feed';
import { requireUserId } from '@/lib/api/auth';
import { Errors } from '@/lib/core/errors/catalog';
import type { ServerTiming } from '@/lib/infra/http/server-timing';

vi.mock('@/lib/actions/chat-groups/feed', () => ({
  listGroupMealFeed: vi.fn(),
}));
vi.mock('@/lib/api/auth', () => ({ requireUserId: vi.fn() }));

import { GET } from '@/app/api/v1/chat-groups/[groupId]/feed/route';

const context = { params: Promise.resolve({ groupId: 'group-id' }) };

describe('group feed response timing', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('returns the read receipt and timings with the authenticated feed', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.mocked(requireUserId).mockResolvedValue('actor');
    const page = {
      entries: [],
      nextCursor: null,
      readThroughAt: '2026-11-10T00:00:00.000Z',
    };
    vi.mocked(listGroupMealFeed).mockImplementationOnce(
      async (actor, input, _db, timing = {} as ServerTiming) => {
        expect(actor).toBe('actor');
        expect(input).toEqual({
          groupId: 'group-id',
          before: undefined,
          order: 'eaten',
        });
        return timing.measure('page', async () => page);
      }
    );
    const response = await GET(
      new NextRequest(
        'https://kallo.fit/api/v1/chat-groups/group-id/feed?order=eaten'
      ),
      context
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expect(response.headers.get('Server-Timing')).toMatch(
      /^auth;dur=\d+\.\d, page;dur=\d+\.\d$/
    );
    const event = JSON.parse(log.mock.calls[0][0]);
    expect(event).toEqual({
      kind: 'circle_feed_timing_v1',
      status: 200,
      stagesMs: { auth: expect.any(Number), page: expect.any(Number) },
    });
  });

  it('times an auth failure without running the feed', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.mocked(requireUserId).mockRejectedValueOnce(Errors.notAuthenticated());
    const response = await GET(
      new NextRequest('https://kallo.fit/api/v1/chat-groups/group-id/feed'),
      context
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('Server-Timing')).toMatch(/^auth;dur=\d+\.\d$/);
    expect(listGroupMealFeed).not.toHaveBeenCalled();
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({
      kind: 'circle_feed_timing_v1',
      status: 401,
      stagesMs: { auth: expect.any(Number) },
    });
  });
});
