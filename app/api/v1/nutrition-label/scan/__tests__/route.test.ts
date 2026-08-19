import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAuthAndProfile = vi.fn();
const validateNutritionLabelImage = vi.fn();
const scanNutritionLabelWithGemini = vi.fn();

vi.mock('@/lib/infra/auth/session', () => ({ requireAuthAndProfile }));

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

vi.mock('@/lib/ai/pipeline/estimator/label-ocr/label-ocr', () => ({
  scanNutritionLabelWithGemini,
}));

const { NutritionOcrImageError } = await import(
  '@/lib/domain/nutrition/ocr/image'
);
const { POST } = await import('@/app/api/v1/nutrition-label/scan/route');

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
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
  requireAuthAndProfile.mockResolvedValue({
    user: { id: 'user-123' },
    profile: {},
  });
  validateNutritionLabelImage.mockResolvedValue(undefined);
  scanNutritionLabelWithGemini.mockResolvedValue(parsedLabel);
});

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

  it('maps a provider 429 to a retryable OCR_RATE_LIMITED envelope', async () => {
    scanNutritionLabelWithGemini.mockRejectedValueOnce(
      Object.assign(new Error('busy'), { status: 429 })
    );

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
    const { error } = await res.json();
    expect(error).toMatchObject({
      code: 'OCR_RATE_LIMITED',
      status: 429,
      retryable: true,
    });
  });

  it('falls through to a generic 500 for an unclassified provider fault', async () => {
    scanNutritionLabelWithGemini.mockRejectedValueOnce(new Error('boom'));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });
});
