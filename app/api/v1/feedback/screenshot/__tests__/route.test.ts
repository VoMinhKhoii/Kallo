import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireUserId = vi.fn();
const assertRateLimit = vi.fn();
const uploadFeedbackScreenshotAction = vi.fn();

vi.mock('@/lib/api/auth', () => ({ requireUserId }));
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({ assertRateLimit }));
vi.mock('@/lib/actions/support/feedback', () => ({
  uploadFeedbackScreenshotAction,
}));

const { POST } = await import('@/app/api/v1/feedback/screenshot/route');
const { MAX_IMAGE_BYTES } = await import('@/lib/infra/uploads/image-file');

const screenshot = () =>
  new File([new Uint8Array([1, 2, 3])], 'shot.png', { type: 'image/png' });

/** A request whose body read is observable, so "the body was never buffered"
 *  is something the tests can actually assert rather than infer. */
function makeRequest(
  contentLength: string | null,
  file: unknown = screenshot()
) {
  const formData = vi.fn(async () => ({
    get: (name: string) => (name === 'file' ? file : null),
  }));
  const req = {
    headers: {
      get: (header: string) =>
        header === 'content-length' ? contentLength : null,
    },
    formData,
  } as unknown as NextRequest;
  return { req, formData };
}

beforeEach(() => {
  requireUserId.mockReset();
  assertRateLimit.mockReset();
  uploadFeedbackScreenshotAction.mockReset();
  requireUserId.mockResolvedValue('user-123');
  assertRateLimit.mockResolvedValue(undefined);
  uploadFeedbackScreenshotAction.mockResolvedValue({
    path: 'user-123/shot.png',
  });
});

describe('POST /api/v1/feedback/screenshot', () => {
  it('uploads the screenshot on the happy path', async () => {
    const { req, formData } = makeRequest('2048');

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ path: 'user-123/shot.png' });
    expect(formData).toHaveBeenCalledOnce();
    expect(assertRateLimit).toHaveBeenCalledWith('feedbackScreenshot', {
      kind: 'user',
      value: 'user-123',
    });
  });

  it('rejects an unauthenticated caller with 401 WITHOUT reading the body', async () => {
    // The regression this pins: the route used to buffer the whole multipart
    // body before it ever asked who was calling.
    const { Errors } = await import('@/lib/core/errors/catalog');
    requireUserId.mockRejectedValueOnce(Errors.notAuthenticated());
    const { req, formData } = makeRequest('2048');

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(formData).not.toHaveBeenCalled();
    expect(assertRateLimit).not.toHaveBeenCalled();
    expect(uploadFeedbackScreenshotAction).not.toHaveBeenCalled();
  });

  it('answers 429 with Retry-After when the per-user limit blocks', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    assertRateLimit.mockRejectedValueOnce(Errors.rateLimited(undefined, 12));
    const { req, formData } = makeRequest('2048');

    const res = await POST(req);

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('12');
    const { error } = await res.json();
    expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    // Blocked before the body is buffered, which is the point of the guard.
    expect(formData).not.toHaveBeenCalled();
    expect(uploadFeedbackScreenshotAction).not.toHaveBeenCalled();
  });

  it('rejects an oversized Content-Length before buffering the body', async () => {
    const { req, formData } = makeRequest(String(MAX_IMAGE_BYTES * 2 + 1));

    const res = await POST(req);

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(formData).not.toHaveBeenCalled();
    expect(uploadFeedbackScreenshotAction).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null],
    ['non-numeric', 'not-a-number'],
  ])('rejects a %s Content-Length before buffering the body', async (_name, header) => {
    // A chunked upload declaring no length would otherwise buffer unbounded.
    const { req, formData } = makeRequest(header);

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(formData).not.toHaveBeenCalled();
  });

  it('rejects a request with no `file` part', async () => {
    const { req } = makeRequest('2048', null);

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(uploadFeedbackScreenshotAction).not.toHaveBeenCalled();
  });
});
