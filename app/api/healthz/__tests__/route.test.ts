import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
const consoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);

vi.mock('@/lib/db', () => ({
  db: {
    execute,
  },
}));

const { GET } = await import('@/app/api/healthz/route');

describe('GET /api/healthz', () => {
  beforeEach(() => {
    execute.mockReset();
    consoleError.mockClear();
  });

  it('returns 200 when the shared staging database invariants hold', async () => {
    execute.mockResolvedValueOnce([
      {
        has_user_profiles: 1,
        has_food_table: 1,
        has_food_source_id: 1,
        has_new_user_trigger: 1,
        seeded_food_rows: 526,
        orphaned_auth_users: 0,
      },
    ]);

    const res = await GET();

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({
      ok: true,
      service: 'nham',
      checks: {
        hasUserProfiles: true,
        hasFoodTable: true,
        hasFoodSourceId: true,
        hasNewUserTrigger: true,
        seededFoodRows: 526,
        orphanedAuthUsers: 0,
      },
    });
  });

  it('returns 503 when the shared staging database is unhealthy', async () => {
    execute.mockResolvedValueOnce([
      {
        has_user_profiles: 1,
        has_food_table: 1,
        has_food_source_id: 1,
        has_new_user_trigger: 0,
        seeded_food_rows: 0,
        orphaned_auth_users: 2,
      },
    ]);

    const res = await GET();

    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json).toEqual({
      ok: false,
      service: 'nham',
      checks: {
        hasUserProfiles: true,
        hasFoodTable: true,
        hasFoodSourceId: true,
        hasNewUserTrigger: false,
        seededFoodRows: 0,
        orphanedAuthUsers: 2,
      },
    });
  });

  it('returns 503 when the shared staging database query fails', async () => {
    execute.mockRejectedValueOnce(new Error('DATABASE_URL is not set.'));

    const res = await GET();

    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json).toEqual({
      ok: false,
      service: 'nham',
      error: 'Shared database health check failed.',
    });
    expect(consoleError).toHaveBeenCalled();
  });
});
