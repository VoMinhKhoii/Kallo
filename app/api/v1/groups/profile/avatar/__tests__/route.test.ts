import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The avatar route's inventory row names ONE policy for the whole file, and a
 * method that skipped it made that row false: DELETE still writes storage and
 * the profile row, so an unlimited delete/upload alternation walked straight
 * past the upload cap.
 */

const assertRateLimit = vi.fn();
const removeMyAvatar = vi.fn();
const uploadMyAvatar = vi.fn();
const getUser = vi.fn();

vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({ assertRateLimit }));
vi.mock('@/lib/actions/groups/avatar', () => ({
  removeMyAvatar,
  uploadMyAvatar,
}));
vi.mock('@/lib/infra/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const { DELETE, POST } = await import(
  '@/app/api/v1/groups/profile/avatar/route'
);

beforeEach(() => {
  assertRateLimit.mockReset();
  removeMyAvatar.mockReset();
  uploadMyAvatar.mockReset();
  getUser.mockReset();
  assertRateLimit.mockResolvedValue(undefined);
  removeMyAvatar.mockResolvedValue({ avatarUrl: null });
  uploadMyAvatar.mockResolvedValue({ avatarUrl: 'u' });
  getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
});

describe('DELETE /api/v1/groups/profile/avatar', () => {
  it('charges the upload limit after auth', async () => {
    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(assertRateLimit).toHaveBeenCalledWith('avatarUpload', {
      kind: 'user',
      value: 'user-1',
    });
  });

  it('scopes the removal by the session user id only (KALLO-05)', async () => {
    await DELETE();

    // No session storage client is handed down: the action writes as
    // service role and the verified id is the only thing scoping the path.
    expect(removeMyAvatar).toHaveBeenCalledWith('user-1');
  });

  it('never charges an anonymous caller', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await DELETE();
    expect(res.status).toBe(401);
    expect(assertRateLimit).not.toHaveBeenCalled();
    expect(removeMyAvatar).not.toHaveBeenCalled();
  });

  it('answers a block with 429 + Retry-After, before the write', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    assertRateLimit.mockRejectedValueOnce(Errors.rateLimited(undefined, 12));

    const res = await DELETE();
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('12');
    expect(removeMyAvatar).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/groups/profile/avatar', () => {
  /** Only the two members the route reads: the length header + the form. */
  function uploadRequest(form: FormData) {
    return {
      headers: new Headers({ 'content-length': '64' }),
      formData: async () => form,
    } as unknown as Parameters<typeof POST>[0];
  }

  it('hands the file to the action with the session user id only', async () => {
    const form = new FormData();
    form.set('file', new File([new Uint8Array([1])], 'a.png'));

    const res = await POST(uploadRequest(form));

    expect(res.status).toBe(200);
    expect(uploadMyAvatar).toHaveBeenCalledTimes(1);
    const args = uploadMyAvatar.mock.calls[0];
    expect(args[0]).toBe('user-1');
    expect(args[1]).toBeInstanceOf(File);
    // No path, bucket or storage client is ever taken from the request.
    expect(args).toHaveLength(2);
  });

  it('never uploads for an anonymous caller', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await POST(uploadRequest(new FormData()));

    expect(res.status).toBe(401);
    expect(uploadMyAvatar).not.toHaveBeenCalled();
  });
});
