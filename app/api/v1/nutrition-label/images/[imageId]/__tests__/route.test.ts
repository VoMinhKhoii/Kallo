import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireUserId = vi.fn();
const assertRateLimit = vi.fn();
const createSignedUrl = vi.fn();
/** Stored rows: one photo, owned by OWNER. */
const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';
const IMAGE = '33333333-3333-4333-8333-333333333333';
const PATH = `${OWNER}/${IMAGE}.jpg`;

vi.mock('@/lib/api/auth', () => ({ requireUserId }));
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({ assertRateLimit }));
vi.mock('@/lib/infra/supabase/admin', () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ createSignedUrl }) },
  }),
}));
// The real ownership query runs; this stand-in answers it like Postgres would
// for the one stored row, by reading the compiled predicate's bound values.
vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (where: SQL) => ({
          limit: async () => {
            const { params } = new PgDialect().sqlToQuery(where);
            return params[0] === IMAGE && params[1] === OWNER
              ? [{ storagePath: PATH }]
              : [];
          },
        }),
      }),
    }),
  },
}));

const { GET } = await import(
  '@/app/api/v1/nutrition-label/images/[imageId]/route'
);

function get(imageId: string) {
  return GET(
    new Request(
      `http://localhost/api/v1/nutrition-label/images/${imageId}`
    ) as unknown as NextRequest,
    { params: Promise.resolve({ imageId }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUserId.mockResolvedValue(OWNER);
  assertRateLimit.mockResolvedValue(undefined);
  createSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://storage.example/signed' },
    error: null,
  });
});

describe('GET /api/v1/nutrition-label/images/{imageId}', () => {
  it('returns a short-lived signed URL for the owner', async () => {
    const res = await get(IMAGE);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://storage.example/signed');
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now());
    expect(createSignedUrl).toHaveBeenCalledWith(PATH, 600);
    expect(assertRateLimit).toHaveBeenCalledWith('labelImageView', {
      kind: 'user',
      value: OWNER,
    });
  });

  it("404s another user's image and signs nothing", async () => {
    requireUserId.mockResolvedValue(STRANGER);

    const res = await get(IMAGE);

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('NOT_FOUND');
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('404s a malformed id the same way', async () => {
    const res = await get('not-a-uuid');
    expect(res.status).toBe(404);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('401s without a session, before the rate limiter', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    requireUserId.mockRejectedValue(Errors.notAuthenticated());

    const res = await get(IMAGE);
    expect(res.status).toBe(401);
    expect(assertRateLimit).not.toHaveBeenCalled();
  });

  it('429s when the per-user limit is spent', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    assertRateLimit.mockRejectedValue(Errors.rateLimited(undefined, 7));

    const res = await get(IMAGE);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('7');
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
