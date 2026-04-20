import { describe, expect, it } from 'vitest';

const { GET } = await import('@/app/api/healthz/route');

describe('GET /api/healthz', () => {
  it('returns 200 with ok:true and service:nham', async () => {
    const res = await GET();

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({ ok: true, service: 'nham' });
  });
});
