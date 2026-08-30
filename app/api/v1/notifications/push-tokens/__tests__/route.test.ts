// Two things make this route more than plumbing, and both are pinned here:
// POST must REASSIGN a token whose row belongs to somebody else (the OS hands
// the same registration string to whoever signs in next on that handset — a
// stale owner would mean one person's notifications on another's phone), and
// DELETE must be scoped to the caller (otherwise knowing a token silences its
// owner's device).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireUserId, mockReadJsonBody, mockInsert, mockDelete } =
  vi.hoisted(() => ({
    mockRequireUserId: vi.fn(),
    mockReadJsonBody: vi.fn(),
    mockInsert: vi.fn(),
    mockDelete: vi.fn(),
  }));

vi.mock('@/lib/api/auth', () => ({
  requireUserId: mockRequireUserId,
  readJsonBody: mockReadJsonBody,
}));
vi.mock('@/lib/infra/db/client', () => ({
  db: { insert: mockInsert, delete: mockDelete },
}));

import { DELETE, POST } from '@/app/api/v1/notifications/push-tokens/route';
import { Errors } from '@/lib/core/errors/catalog';

const USER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TOKEN = 'fcm-registration-token';

/** Captures the values row and the onConflictDoUpdate spec. */
function capturingInsert() {
  const captured: { values?: unknown; conflict?: unknown } = {};
  mockInsert.mockReturnValue({
    values: vi.fn((values: unknown) => {
      captured.values = values;
      return {
        onConflictDoUpdate: vi.fn((spec: unknown) => {
          captured.conflict = spec;
          return Promise.resolve(undefined);
        }),
      };
    }),
  });
  return captured;
}

function capturingDelete(rows: unknown[]) {
  const captured: { where?: unknown } = {};
  mockDelete.mockReturnValue({
    where: vi.fn((clause: unknown) => {
      captured.where = clause;
      return { returning: vi.fn().mockResolvedValue(rows) };
    }),
  });
  return captured;
}

describe('POST /api/v1/notifications/push-tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUserId.mockResolvedValue(USER);
  });

  it('upserts on the token, reassigning ownership and refreshing liveness', async () => {
    mockReadJsonBody.mockResolvedValue({ token: TOKEN, platform: 'ios' });
    const captured = capturingInsert();

    const response = await POST({} as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ registered: true });
    expect(captured.values).toEqual({
      userId: USER,
      token: TOKEN,
      platform: 'ios',
    });
    const conflict = captured.conflict as {
      set: { userId: string; platform: string; lastSeenAt: Date };
    };
    // The reassignment IS the point: same token, new owner.
    expect(conflict.set.userId).toBe(USER);
    expect(conflict.set.platform).toBe('ios');
    expect(conflict.set.lastSeenAt).toBeInstanceOf(Date);
  });

  it('rejects an unsupported platform before touching the database', async () => {
    mockReadJsonBody.mockResolvedValue({ token: TOKEN, platform: 'symbian' });

    const response = await POST({} as never);

    expect(response.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejects an empty token', async () => {
    mockReadJsonBody.mockResolvedValue({ token: '', platform: 'ios' });

    const response = await POST({} as never);

    expect(response.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('answers 401 without a session, and never registers', async () => {
    mockRequireUserId.mockRejectedValue(Errors.notAuthenticated());

    const response = await POST({} as never);

    expect(response.status).toBe(401);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/v1/notifications/push-tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUserId.mockResolvedValue(USER);
  });

  it('deletes the caller’s registration and reports how many rows went', async () => {
    mockReadJsonBody.mockResolvedValue({ token: TOKEN });
    const captured = capturingDelete([{ id: 'row-1' }]);

    const response = await DELETE({} as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ removed: 1 });
    // Both predicates present: user AND token (see the route's `and(...)`).
    expect(captured.where).toBeDefined();
  });

  it('is a no-op for a token that is not the caller’s', async () => {
    mockReadJsonBody.mockResolvedValue({ token: 'someone-elses-token' });
    capturingDelete([]);

    const response = await DELETE({} as never);

    await expect(response.json()).resolves.toEqual({ removed: 0 });
  });

  it('answers 401 without a session, and never deletes', async () => {
    mockRequireUserId.mockRejectedValue(Errors.notAuthenticated());

    const response = await DELETE({} as never);

    expect(response.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
