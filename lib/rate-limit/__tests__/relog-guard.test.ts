import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkAnalysisGuards = vi.fn();
vi.mock('@/lib/rate-limit/analysis-guards', () => ({ checkAnalysisGuards }));

const { withRelogGuard } = await import('@/lib/rate-limit/relog-guard');
const { isAppError } = await import('@/lib/errors/app-error');
const { serializeError } = await import('@/lib/errors/serialize');

const release = vi.fn();

beforeEach(() => {
  checkAnalysisGuards.mockReset();
  release.mockReset();
  checkAnalysisGuards.mockResolvedValue({ allowed: true, release });
});

describe('withRelogGuard', () => {
  it('runs the work under the limits for its kind', async () => {
    const work = vi.fn().mockResolvedValue('ok');

    await expect(
      withRelogGuard('candidates', 'meals-relog-candidates', 'user-1', work)
    ).resolves.toBe('ok');

    expect(checkAnalysisGuards).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        route: 'meals-relog-candidates',
        limits: expect.objectContaining({ concurrentUser: 2 }),
      })
    );
    expect(work).toHaveBeenCalledOnce();
  });

  it('applies the stricter write limits to the write kind', async () => {
    await withRelogGuard('write', 'meals-relog-write', 'user-1', async () => 1);

    expect(checkAnalysisGuards).toHaveBeenCalledWith(
      expect.objectContaining({
        limits: expect.objectContaining({
          perUserMinute: 12,
          concurrentUser: 1,
        }),
      })
    );
  });

  it('never runs the work when throttled', async () => {
    checkAnalysisGuards.mockResolvedValue({
      allowed: false,
      status: 429,
      retryAfterSeconds: 7,
    });
    const work = vi.fn();

    await expect(
      withRelogGuard('candidates', 'r', 'user-1', work)
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    expect(work).not.toHaveBeenCalled();
  });

  it('carries Retry-After through to the serialized response', async () => {
    // A Server Action has no Response to attach a header to, so the wait has to
    // ride on the error itself or the client backs off for a guessed interval.
    checkAnalysisGuards.mockResolvedValue({
      allowed: false,
      status: 429,
      retryAfterSeconds: 7,
    });

    const error = await withRelogGuard(
      'write',
      'r',
      'user-1',
      async () => 'unreachable'
    ).catch((e) => e);

    expect(isAppError(error)).toBe(true);
    const res = serializeError(error);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('7');
  });

  it('releases the in-flight slot on success', async () => {
    await withRelogGuard('write', 'r', 'user-1', async () => 'done');
    expect(release).toHaveBeenCalledOnce();
  });

  it('releases the in-flight slot when the work throws', async () => {
    // The in-flight counter is what enforces concurrency — leaking one locks
    // the user out of relog until the stale-counter sweep catches up.
    await expect(
      withRelogGuard('write', 'r', 'user-1', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(release).toHaveBeenCalledOnce();
  });

  it('does not release a slot it never acquired', async () => {
    checkAnalysisGuards.mockResolvedValue({
      allowed: false,
      status: 429,
      retryAfterSeconds: 1,
    });

    await withRelogGuard('write', 'r', 'user-1', async () => 1).catch(() => {});
    expect(release).not.toHaveBeenCalled();
  });
});
