import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAuthAndProfile = vi.fn();
const validateNutritionLabelImage = vi.fn();
const scanNutritionLabelWithGemini = vi.fn();
const withOcrGuard = vi.fn();
const chargeGlobal = vi.fn();
const assertFeatureAccess = vi.fn();
// The kept-scan writes (lib/domain/nutrition/label-images/): the real module
// runs against these, so the route's storage behaviour is what is asserted.
const upload = vi.fn();
const insertValues = vi.fn();
const after = vi.fn();

vi.mock('@/lib/infra/auth/session', () => ({ requireAuthAndProfile }));
vi.mock('@/lib/domain/billing/feature-gate', () => ({ assertFeatureAccess }));
vi.mock('next/server', async (importActual) => ({
  ...(await importActual<typeof import('next/server')>()),
  after,
}));
vi.mock('@/lib/infra/supabase/admin', () => ({
  createAdminClient: () => ({ storage: { from: () => ({ upload }) } }),
}));
vi.mock('@/lib/infra/db/client', () => ({
  db: { insert: () => ({ values: insertValues }) },
}));
vi.mock('@/lib/ai/pipeline/estimator/label-ocr/label-ocr', () => ({
  scanNutritionLabelWithGemini,
  NUTRITION_LABEL_OCR_MODEL: 'test-ocr-model',
}));

// The OCR spend guard is exercised in its own unit test; here it is a
// transparent pass-through by default, so the route's own behaviour is what is
// under test. Individual cases override it to prove a guard block/outage
// surfaces on the standard envelope.
vi.mock('@/lib/infra/rate-limit/ocr-guard', () => ({ withOcrGuard }));

vi.mock('@/lib/domain/nutrition/ocr/image', async (importActual) => {
  // Keep the real NutritionOcrImageError so the route's mapper sees the same
  // `code` the mock throws.
  const actual =
    await importActual<typeof import('@/lib/domain/nutrition/ocr/image')>();
  return {
    NutritionOcrImageError: actual.NutritionOcrImageError,
    detectOcrImageMime: actual.detectOcrImageMime,
    validateNutritionLabelImage,
  };
});

const { NutritionOcrImageError } = await import(
  '@/lib/domain/nutrition/ocr/image'
);
const { POST } = await import('@/app/api/v1/nutrition-label/scan/route');

/** A real `Request`, because the route now reads its body through
 *  `readBoundedJson` (a streaming reader), not `req.json()`. */
function makeRequest(
  body: unknown,
  init?: { contentLength?: string }
): NextRequest {
  return new Request('http://localhost/api/v1/nutrition-label/scan', {
    method: 'POST',
    headers: init?.contentLength
      ? { 'content-length': init.contentLength }
      : undefined,
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

/** A 1x1 JPEG is irrelevant here (validation is mocked) — only the base64
 * shape matters, and it must decode to a length divisible by 4. */
const validBody = {
  imageBase64: 'aGVsbG8gbGFiZWw=',
  mimeType: 'image/jpeg',
};

const parsedLabel = {
  basis: 'per_100g',
  productName: 'Bánh quy',
  labelEvidence: 'Thông tin dinh dưỡng',
  servingSize: null,
  servingSizeDescription: null,
  servingsPerContainer: null,
  confidence: 'high',
  per100g: { calories: 480, proteinGrams: 6 },
};

beforeEach(() => {
  requireAuthAndProfile.mockReset();
  validateNutritionLabelImage.mockReset();
  scanNutritionLabelWithGemini.mockReset();
  withOcrGuard.mockReset();
  // Default: run the guarded work directly with a no-op `chargeGlobal`,
  // exactly as a passing guard would. `chargeGlobal` is a spy so the cases
  // below can prove WHEN the app-wide budget is charged.
  chargeGlobal.mockReset();
  chargeGlobal.mockResolvedValue(undefined);
  withOcrGuard.mockImplementation(
    (
      _userId: string,
      work: (charge: () => Promise<void>) => Promise<unknown>
    ) => work(chargeGlobal)
  );
  requireAuthAndProfile.mockResolvedValue({
    user: { id: 'user-123' },
    profile: {},
  });
  validateNutritionLabelImage.mockResolvedValue(undefined);
  scanNutritionLabelWithGemini.mockResolvedValue(parsedLabel);
  assertFeatureAccess.mockReset();
  assertFeatureAccess.mockResolvedValue(undefined);
  upload.mockReset();
  upload.mockResolvedValue({ data: {}, error: null });
  insertValues.mockReset();
  insertValues.mockResolvedValue(undefined);
  after.mockReset();
});

/** Resolve the post-response writes handed to `after()`. */
async function settleAfter() {
  await Promise.all(after.mock.calls.map(([pending]) => pending));
}

/** The model answers on a later event-loop turn, as the real call does. */
function geminiAfterATick(outcome: () => unknown) {
  scanNutritionLabelWithGemini.mockImplementationOnce(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    return outcome();
  });
}

/** Everything the client can observe about a reply. */
async function observe(res: Response) {
  return {
    status: res.status,
    retryAfter: res.headers.get('Retry-After'),
    body: await res.text(),
  };
}

describe('POST /api/v1/nutrition-label/scan', () => {
  it('validates the image then returns the parsed label', async () => {
    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ label: parsedLabel });
    expect(validateNutritionLabelImage).toHaveBeenCalledWith(
      expect.objectContaining(validBody)
    );
    expect(scanNutritionLabelWithGemini).toHaveBeenCalledWith(validBody);
  });

  it('rejects an unauthenticated request with 401 before touching the image', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    requireAuthAndProfile.mockRejectedValueOnce(Errors.notAuthenticated());

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    expect(validateNutritionLabelImage).not.toHaveBeenCalled();
  });

  it('rejects an unsupported mime type with 400 VALIDATION_FAILED', async () => {
    const res = await POST(
      makeRequest({ ...validBody, mimeType: 'image/gif' })
    );

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(scanNutritionLabelWithGemini).not.toHaveBeenCalled();
  });

  it('rejects malformed base64 with 400 before decoding it', async () => {
    const res = await POST(
      makeRequest({ ...validBody, imageBase64: 'not base64!!' })
    );

    expect(res.status).toBe(400);
    expect(validateNutritionLabelImage).not.toHaveBeenCalled();
  });

  it('maps an undecodable image to a 400 OCR_INVALID_IMAGE envelope', async () => {
    validateNutritionLabelImage.mockRejectedValueOnce(
      new NutritionOcrImageError('Image bytes could not be decoded')
    );

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error).toMatchObject({
      code: 'OCR_INVALID_IMAGE',
      status: 400,
      retryable: false,
    });
  });

  it('maps a photo with no printed table to a 422 OCR_NO_LABEL_DETECTED envelope', async () => {
    scanNutritionLabelWithGemini.mockRejectedValueOnce(
      Object.assign(new Error('no label'), { code: 'no_label_detected' })
    );

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(422);
    const { error } = await res.json();
    expect(error).toMatchObject({
      code: 'OCR_NO_LABEL_DETECTED',
      status: 422,
    });
  });

  it('maps a provider 429 to a retryable 429 carrying Retry-After', async () => {
    scanNutritionLabelWithGemini.mockRejectedValueOnce(
      Object.assign(new Error('busy'), { status: 429 })
    );

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
    // A 429 with no Retry-After makes the client guess, and a client that
    // guesses low walks straight back into the provider's wall.
    expect(res.headers.get('Retry-After')).toBe('30');
    const { error } = await res.json();
    expect(error).toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      retryable: true,
    });
  });

  it("preserves the provider's own retry hint when it sent one", async () => {
    scanNutritionLabelWithGemini.mockRejectedValueOnce(
      Object.assign(new Error('busy'), { status: 429, retryDelay: '12s' })
    );

    const res = await POST(makeRequest(validBody));
    expect(res.headers.get('Retry-After')).toBe('12');
  });

  it('falls through to a generic 500 for an unclassified provider fault', async () => {
    scanNutritionLabelWithGemini.mockRejectedValueOnce(new Error('boom'));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });

  it('charges the app-wide budget only after validation, right before Gemini', async () => {
    const order: string[] = [];
    validateNutritionLabelImage.mockImplementation(async () => {
      order.push('validate');
    });
    chargeGlobal.mockImplementation(async () => {
      order.push('charge');
    });
    scanNutritionLabelWithGemini.mockImplementation(async () => {
      order.push('gemini');
      return parsedLabel;
    });

    await POST(makeRequest(validBody));
    expect(order).toEqual(['validate', 'charge', 'gemini']);
  });

  it('never charges the app-wide budget for a body that fails validation', async () => {
    const res = await POST(
      makeRequest({ ...validBody, mimeType: 'image/gif' })
    );

    expect(res.status).toBe(400);
    expect(chargeGlobal).not.toHaveBeenCalled();
  });

  it('refuses an oversized body with 413 before parsing or charging anything', async () => {
    // The content-length prefilter: refused before a byte is read, so the
    // multi-MB payload never reaches JSON.parse or the base64 regex.
    const res = await POST(
      makeRequest(validBody, { contentLength: String(64 * 1024 * 1024) })
    );

    expect(res.status).toBe(413);
    const { error } = await res.json();
    expect(error).toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
      status: 413,
      retryable: false,
    });
    expect(validateNutritionLabelImage).not.toHaveBeenCalled();
    expect(chargeGlobal).not.toHaveBeenCalled();
  });

  it('passes a per-user OCR guard block through as 429 + Retry-After', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    // The guard runs BEFORE the work, so a block never reaches Gemini.
    withOcrGuard.mockRejectedValueOnce(Errors.rateLimited(undefined, 5));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('5');
    const { error } = await res.json();
    // Passed through UNTOUCHED — the limiter's own `RATE_LIMITED`, not the
    // provider-shaped `OCR_RATE_LIMITED` (which would have dropped Retry-After).
    expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    expect(scanNutritionLabelWithGemini).not.toHaveBeenCalled();
  });

  it('passes a fail-closed limiter outage through as 503 + Retry-After', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    withOcrGuard.mockRejectedValueOnce(Errors.rateLimiterUnavailable());

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('10');
    const { error } = await res.json();
    expect(error).toMatchObject({
      code: 'RATE_LIMITER_UNAVAILABLE',
      status: 503,
      retryable: true,
    });
  });
});

describe('POST /api/v1/nutrition-label/scan — keeping the scan', () => {
  it('returns the kept id and records the result with the photo path', async () => {
    geminiAfterATick(() => parsedLabel);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const { label, labelImageId } = await res.json();
    expect(label).toEqual(parsedLabel);
    expect(labelImageId).toMatch(/^[0-9a-f-]{36}$/);
    expect(upload).toHaveBeenCalledWith(
      `user-123/${labelImageId}.jpg`,
      expect.any(Buffer),
      { contentType: 'image/jpeg', upsert: false }
    );

    await settleAfter();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: labelImageId,
        userId: 'user-123',
        storagePath: `user-123/${labelImageId}.jpg`,
        status: 'succeeded',
        result: parsedLabel,
        errorCode: null,
      })
    );
  });

  it('a storage failure leaves the success reply exactly as before', async () => {
    upload.mockResolvedValue({ data: null, error: new Error('down') });
    geminiAfterATick(() => parsedLabel);

    const res = await POST(makeRequest(validBody));
    expect(await observe(res)).toEqual({
      status: 200,
      retryAfter: null,
      body: JSON.stringify({ label: parsedLabel }),
    });
    await settleAfter();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it.each([
    [
      'no label',
      () => Object.assign(new Error('no label'), { code: 'no_label_detected' }),
      'no_label_detected',
    ],
    [
      'provider 429',
      () => Object.assign(new Error('busy'), { status: 429 }),
      'rate_limited',
    ],
    [
      'deadline',
      () => new DOMException('Nutrition label OCR timed out', 'AbortError'),
      'timeout',
    ],
    ['provider fault', () => new Error('boom'), 'server_error'],
  ])('%s: records a failed scan; the reply is identical with storage up or down', async (_name, makeError, code) => {
    scanNutritionLabelWithGemini.mockRejectedValueOnce(makeError());
    const kept = await observe(await POST(makeRequest(validBody)));
    await settleAfter();
    expect(insertValues).toHaveBeenCalledTimes(1);
    const [row] = insertValues.mock.calls[0];
    expect(row).toMatchObject({
      userId: 'user-123',
      status: 'failed',
      result: null,
      errorCode: code,
    });
    expect(row.storagePath).toBe(`user-123/${row.id}.jpg`);

    upload.mockResolvedValue({ data: null, error: new Error('down') });
    scanNutritionLabelWithGemini.mockRejectedValueOnce(makeError());
    const notKept = await observe(await POST(makeRequest(validBody)));
    expect(notKept).toEqual(kept);
  });

  it.each([
    [
      'unauthenticated',
      async () => {
        const { Errors } = await import('@/lib/core/errors/catalog');
        requireAuthAndProfile.mockRejectedValueOnce(Errors.notAuthenticated());
      },
      validBody,
    ],
    [
      'feature locked',
      async () => {
        const { Errors } = await import('@/lib/core/errors/catalog');
        assertFeatureAccess.mockRejectedValueOnce(
          Errors.featureLocked('label_scan', 'trial_expired')
        );
      },
      validBody,
    ],
    [
      'unsupported mime',
      async () => {},
      { ...validBody, mimeType: 'image/gif' },
    ],
    [
      'undecodable image',
      async () => {
        validateNutritionLabelImage.mockRejectedValueOnce(
          new NutritionOcrImageError('Image bytes could not be decoded')
        );
      },
      validBody,
    ],
    [
      'per-user guard block',
      async () => {
        const { Errors } = await import('@/lib/core/errors/catalog');
        withOcrGuard.mockRejectedValueOnce(Errors.rateLimited(undefined, 5));
      },
      validBody,
    ],
    [
      'app-wide budget refused',
      async () => {
        const { Errors } = await import('@/lib/core/errors/catalog');
        chargeGlobal.mockRejectedValueOnce(Errors.rateLimiterUnavailable());
      },
      validBody,
    ],
  ])('%s: rejected before the model call, so nothing is kept', async (_name, arrange, body) => {
    await arrange();

    const res = await POST(makeRequest(body));
    expect(res.status).toBeGreaterThanOrEqual(400);
    await settleAfter();
    expect(scanNutritionLabelWithGemini).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });
});
