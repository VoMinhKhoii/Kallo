import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import sharp from 'sharp';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { OcrReviewStep } from '@/components/logging/input/ocr/review/ocr-review-step';
import type {
  NutritionValues as OcrNutritionValues,
  OcrReviewPayload,
  ParsedNutritionLabel,
} from '@/lib/domain/nutrition/ocr/schema';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    insert: vi.fn(),
  },
}));

const {
  mockRequireAuthAndProfile,
  mockUser,
  mockCheckFeatureGate,
  mockWithOcrGuard,
  mockChargeGlobal,
  mockUpload,
  mockAfter,
} = vi.hoisted(() => ({
  mockRequireAuthAndProfile: vi.fn(),
  mockUser: { id: 'user-123', email: 'test@example.com' },
  mockCheckFeatureGate: vi.fn(),
  mockWithOcrGuard: vi.fn(),
  mockChargeGlobal: vi.fn(),
  mockUpload: vi.fn(),
  mockAfter: vi.fn(),
}));

// The kept-scan photo upload (lib/domain/nutrition/label-images/) and the
// post-response hook its row write rides on.
vi.mock('@/lib/infra/supabase/admin', () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ upload: mockUpload }) },
  }),
}));
vi.mock('next/server', async (importActual) => ({
  ...(await importActual<typeof import('next/server')>()),
  after: mockAfter,
}));

vi.mock('@/lib/infra/auth/session', () => ({
  requireAuthAndProfile: mockRequireAuthAndProfile,
}));

// The OCR spend guard has its own unit test; here it is a transparent
// pass-through by default so the real validation + the mocked Gemini call run.
vi.mock('@/lib/infra/rate-limit/ocr-guard', () => ({
  withOcrGuard: mockWithOcrGuard,
}));

vi.mock('@/lib/domain/billing/feature-gate', () => ({
  checkFeatureGate: mockCheckFeatureGate,
}));

vi.mock('@/lib/ai/pipeline/estimator/label-ocr/label-ocr', () => ({
  scanNutritionLabelWithGemini: vi.fn(),
  NUTRITION_LABEL_OCR_MODEL: 'test-ocr-model',
}));

import {
  scanNutritionLabelAction,
  stageOcrMealAction,
} from '@/lib/actions/logging/nutrition-ocr';
import { scanNutritionLabelWithGemini } from '@/lib/ai/pipeline/estimator/label-ocr/label-ocr';
import { OCR_MAX_IMAGE_BYTES } from '@/lib/domain/nutrition/ocr/image-constants';

let validPngBase64: string;

beforeAll(async () => {
  validPngBase64 = (
    await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: '#ffffff',
      },
    })
      .png()
      .toBuffer()
  ).toString('base64');
});

function nutrition(
  overrides: Partial<OcrNutritionValues> = {}
): OcrNutritionValues {
  return {
    calories: null,
    proteinGrams: null,
    carbsGrams: null,
    fatGrams: null,
    fiberGrams: null,
    sodiumMg: null,
    calciumMg: null,
    ironMg: null,
    magnesiumMg: null,
    phosphorusMg: null,
    potassiumMg: null,
    zincMg: null,
    copperMcg: null,
    manganeseMg: null,
    betaCaroteneMcg: null,
    vitaminAMcg: null,
    vitaminCMg: null,
    vitaminDMcg: null,
    vitaminEMg: null,
    vitaminKMcg: null,
    vitaminB1Mg: null,
    vitaminB2Mg: null,
    vitaminPpMg: null,
    vitaminB5Mg: null,
    vitaminB6Mg: null,
    vitaminB9Mcg: null,
    vitaminB12Mcg: null,
    vitaminHMcg: null,
    ...overrides,
  };
}

function servingLabel(
  values: OcrNutritionValues,
  overrides: Partial<ParsedNutritionLabel> = {}
): ParsedNutritionLabel {
  return {
    productName: 'Mì Hảo Hảo',
    labelEvidence: 'Bảng giá trị dinh dưỡng — Năng lượng, Chất đạm',
    servingSize: { value: 75, unit: 'g' },
    servingSizeDescription: '1 gói (75g)',
    servingsPerContainer: 1,
    basis: 'per_serving',
    perServing: values,
    confidence: 'high',
    ...overrides,
  } as ParsedNutritionLabel;
}

afterEach(cleanup);
// Drain every scan's post-response write (the kept photo's re-encode, upload
// and row), so none of it lands in the next test's mocks.
afterEach(async () => {
  await Promise.all(mockAfter.mock.calls.map(([pending]) => pending));
});

// Entitled by default: every pre-existing expectation is the unlocked path.
beforeEach(() => {
  mockCheckFeatureGate.mockResolvedValue({ locked: false });
  // The guard hands `work` the app-wide-budget charge; here it is a spy, so
  // the cases below can prove WHEN (and whether) that budget is spent.
  mockChargeGlobal.mockResolvedValue(undefined);
  mockWithOcrGuard.mockImplementation(
    (
      _userId: string,
      work: (charge: () => Promise<void>) => Promise<unknown>
    ) => work(mockChargeGlobal)
  );
  mockRequireAuthAndProfile.mockResolvedValue({
    user: mockUser,
    profile: {
      goal: 'cutting',
      aggression: '0.5',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  });
});

describe('scanNutritionLabelAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns feature_locked from both actions without calling Gemini or staging', async () => {
    mockCheckFeatureGate.mockResolvedValue({
      locked: true,
      reason: 'not_entitled',
    });
    const { db } = await import('@/lib/infra/db/client');

    expect(
      await scanNutritionLabelAction({
        imageBase64: validPngBase64,
        mimeType: 'image/png',
      })
    ).toEqual({ success: false, code: 'feature_locked' });
    expect(
      await stageOcrMealAction({
        productName: 'Bánh quy',
        amount: 100,
        unit: 'g',
        confidence: 'high',
        calories: 480,
        proteinGrams: 6,
        carbsGrams: 62,
        fatGrams: 22,
        loggedDate: '2026-08-06',
        timezoneOffset: -420,
      })
    ).toEqual({ success: false, code: 'feature_locked' });

    expect(mockCheckFeatureGate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: mockUser.id }),
      'label_scan'
    );
    expect(scanNutritionLabelWithGemini).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('validates input and returns normalized label data', async () => {
    const mockLabelData = servingLabel(
      nutrition({ calories: 350, proteinGrams: 7.5, carbsGrams: 52 })
    );
    vi.mocked(scanNutritionLabelWithGemini).mockResolvedValue(mockLabelData);

    const result = await scanNutritionLabelAction({
      imageBase64: validPngBase64,
      mimeType: 'image/png',
    });

    expect(result).toEqual({ success: true, data: mockLabelData });
    expect(scanNutritionLabelWithGemini).toHaveBeenCalledWith({
      imageBase64: validPngBase64,
      mimeType: 'image/png',
    });
  });

  it('rejects unsupported, spoofed, and malformed image bytes before Gemini', async () => {
    for (const input of [
      { imageBase64: validPngBase64, mimeType: 'image/gif' },
      { imageBase64: validPngBase64, mimeType: 'image/heic' },
      { imageBase64: validPngBase64, mimeType: 'image/heif' },
      { imageBase64: validPngBase64, mimeType: 'image/jpeg' },
      { imageBase64: 'bm90IGFuIGltYWdl', mimeType: 'image/png' },
    ]) {
      expect(await scanNutritionLabelAction(input)).toEqual({
        success: false,
        code: 'invalid_image',
      });
    }
    expect(scanNutritionLabelWithGemini).not.toHaveBeenCalled();
  });

  it('rejects oversized input after auth, by length, without touching the budget', async () => {
    const oversizedBase64 = 'A'.repeat(
      Math.ceil(((OCR_MAX_IMAGE_BYTES + 1) * 4) / 3 / 4) * 4
    );

    expect(
      await scanNutritionLabelAction({
        imageBase64: oversizedBase64,
        mimeType: 'image/png',
      })
    ).toEqual({ success: false, code: 'invalid_image' });
    // Validation now runs AFTER auth and inside the per-user slot, on purpose:
    // the schema's base64 refinement walks the whole string, so an anonymous
    // caller could otherwise make the server spend that CPU. It is still
    // rejected by a `length` comparison — the cheap check — before the regex,
    // and the app-wide daily budget is never charged for it.
    expect(mockRequireAuthAndProfile).toHaveBeenCalled();
    expect(mockChargeGlobal).not.toHaveBeenCalled();
    expect(scanNutritionLabelWithGemini).not.toHaveBeenCalled();
  });

  it('charges the app-wide budget only after the image decodes, right before Gemini', async () => {
    const order: string[] = [];
    mockChargeGlobal.mockImplementation(async () => {
      order.push('charge');
    });
    vi.mocked(scanNutritionLabelWithGemini).mockImplementation(async () => {
      order.push('gemini');
      return servingLabel(nutrition({ calories: 100 }));
    });

    await scanNutritionLabelAction({
      imageBase64: validPngBase64,
      mimeType: 'image/png',
    });

    expect(order).toEqual(['charge', 'gemini']);
  });

  it('never charges the app-wide budget for an image that fails validation', async () => {
    expect(
      await scanNutritionLabelAction({
        imageBase64: validPngBase64,
        mimeType: 'image/jpeg',
      })
    ).toEqual({ success: false, code: 'invalid_image' });
    expect(mockChargeGlobal).not.toHaveBeenCalled();
  });

  it('does not call Gemini when authentication fails', async () => {
    mockRequireAuthAndProfile.mockRejectedValueOnce(
      new Error('authentication required')
    );

    expect(
      await scanNutritionLabelAction({
        imageBase64: validPngBase64,
        mimeType: 'image/png',
      })
    ).toEqual({ success: false, code: 'server_error' });
    expect(scanNutritionLabelWithGemini).not.toHaveBeenCalled();
  });

  it('maps invalid input, missing labels, rate limits, and provider failures', async () => {
    expect(
      await scanNutritionLabelAction({ imageBase64: '', mimeType: 'bad/type' })
    ).toEqual({ success: false, code: 'invalid_image' });

    vi.mocked(scanNutritionLabelWithGemini).mockRejectedValueOnce({
      code: 'no_label_detected',
    });
    expect(
      await scanNutritionLabelAction({
        imageBase64: validPngBase64,
        mimeType: 'image/png',
      })
    ).toEqual({ success: false, code: 'no_label_detected' });

    vi.mocked(scanNutritionLabelWithGemini).mockRejectedValueOnce({
      code: 'rate_limited',
    });
    expect(
      await scanNutritionLabelAction({
        imageBase64: validPngBase64,
        mimeType: 'image/png',
      })
    ).toEqual({ success: false, code: 'rate_limited' });

    vi.mocked(scanNutritionLabelWithGemini).mockRejectedValueOnce(
      new Error('provider unavailable')
    );
    expect(
      await scanNutritionLabelAction({
        imageBase64: validPngBase64,
        mimeType: 'image/png',
      })
    ).toEqual({ success: false, code: 'server_error' });
  });

  it.each([
    ['provider 429', { status: 429 }, 'rate_limited'],
    [
      'provider timeout',
      new DOMException('Nutrition label OCR timed out', 'AbortError'),
      'server_error',
    ],
    ['unknown provider code', { code: 'made_up' }, 'server_error'],
  ] as const)('maps %s to its stable public code', async (_name, error, code) => {
    vi.mocked(scanNutritionLabelWithGemini).mockRejectedValueOnce(error);

    expect(
      await scanNutritionLabelAction({
        imageBase64: validPngBase64,
        mimeType: 'image/png',
      })
    ).toEqual({ success: false, code });
  });

  it('surfaces an OCR guard block as the rate_limited code', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    // The guard throws BEFORE the work runs, so Gemini is never called.
    mockWithOcrGuard.mockRejectedValueOnce(Errors.rateLimited(undefined, 5));

    expect(
      await scanNutritionLabelAction({
        imageBase64: validPngBase64,
        mimeType: 'image/png',
      })
    ).toEqual({ success: false, code: 'rate_limited' });
    expect(scanNutritionLabelWithGemini).not.toHaveBeenCalled();
  });
});

describe('scanNutritionLabelAction — keeping the scan', () => {
  const mockValues = vi.fn();
  const input = () => ({ imageBase64: validPngBase64, mimeType: 'image/png' });

  async function settleAfter() {
    await Promise.all(mockAfter.mock.calls.map(([pending]) => pending));
  }

  function geminiAfterATick(outcome: () => unknown) {
    vi.mocked(scanNutritionLabelWithGemini).mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      return outcome() as ParsedNutritionLabel;
    });
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { db } = await import('@/lib/infra/db/client');
    vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);
    mockValues.mockResolvedValue(undefined);
    mockUpload.mockResolvedValue({ data: {}, error: null });
  });

  it('records the result with the photo path; the reply carries no kept id', async () => {
    const label = servingLabel(nutrition({ calories: 350 }));
    geminiAfterATick(() => label);

    // The web review flow never links a scan to its meal, so the reply is
    // exactly the pre-storage shape.
    expect(await scanNutritionLabelAction(input())).toEqual({
      success: true,
      data: label,
    });

    await settleAfter();
    expect(mockValues).toHaveBeenCalledTimes(1);
    const [row] = mockValues.mock.calls[0];
    expect(row).toMatchObject({
      userId: mockUser.id,
      storagePath: `${mockUser.id}/${row.id}.png`,
      mimeType: 'image/png',
      status: 'succeeded',
      result: label,
    });
    expect(mockUpload).toHaveBeenCalledWith(
      `${mockUser.id}/${row.id}.png`,
      expect.any(Buffer),
      { contentType: 'image/png', upsert: false }
    );
  });

  it('a storage failure leaves the success result exactly as before', async () => {
    const label = servingLabel(nutrition({ calories: 350 }));
    mockUpload.mockResolvedValue({ data: null, error: new Error('down') });
    geminiAfterATick(() => label);

    expect(await scanNutritionLabelAction(input())).toEqual({
      success: true,
      data: label,
    });
    await settleAfter();
    expect(mockValues).not.toHaveBeenCalled();
  });

  it.each([
    ['no label', { code: 'no_label_detected' }, 'no_label_detected'],
    ['provider fault', new Error('boom'), 'server_error'],
  ])('%s: records a failed scan; the result is identical with storage up or down', async (_name, error, code) => {
    vi.mocked(scanNutritionLabelWithGemini).mockRejectedValueOnce(error);
    const kept = await scanNutritionLabelAction(input());
    await settleAfter();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        result: null,
        errorCode: code,
        storagePath: expect.stringMatching(/^user-123\/[0-9a-f-]{36}\.png$/),
      })
    );

    mockUpload.mockResolvedValue({ data: null, error: new Error('down') });
    vi.mocked(scanNutritionLabelWithGemini).mockRejectedValueOnce(error);
    expect(await scanNutritionLabelAction(input())).toEqual(kept);
  });

  it('keeps nothing for a request refused before the model call', async () => {
    mockCheckFeatureGate.mockResolvedValueOnce({
      locked: true,
      reason: 'not_entitled',
    });
    await scanNutritionLabelAction(input());
    await scanNutritionLabelAction({
      imageBase64: validPngBase64,
      mimeType: 'image/jpeg',
    });
    mockChargeGlobal.mockRejectedValueOnce(new Error('budget spent'));
    await scanNutritionLabelAction(input());

    await settleAfter();
    expect(scanNutritionLabelWithGemini).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockValues).not.toHaveBeenCalled();
  });
});

describe('OCR review to staging seam', () => {
  it('keeps a partial extraction editable and accepts comma decimals', () => {
    const onConfirm = vi.fn();
    render(
      createElement(OcrReviewStep, {
        data: servingLabel(
          nutrition({ calories: 120, proteinGrams: 4, carbsGrams: null })
        ),
        isStaging: false,
        onBack: vi.fn(),
        onConfirm,
      })
    );

    // Confirm is always live; an untouched form is not scolded before the
    // user has asked for anything.
    const confirm = screen.getByRole('button', { name: 'confirm' });
    expect(confirm).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Asking to save with carbohydrates missing reports it on that field and
    // submits nothing.
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText('ocrNutrients.carbohydrates (g)')
    ).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(screen.getByLabelText('ocrNutrients.protein (g)'), {
      target: { value: '3,5' },
    });
    fireEvent.change(screen.getByLabelText('ocrNutrients.carbohydrates (g)'), {
      target: { value: '20' },
    });
    fireEvent.change(screen.getByLabelText('ocrNutrients.fat (g)'), {
      target: { value: '4' },
    });

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        proteinGrams: 3.5,
        carbsGrams: 20,
        fatGrams: 4,
      })
    );
  });

  it('passes every extracted nutrient, confidence, and ml unit into persistence', async () => {
    const { db } = await import('@/lib/infra/db/client');
    const mockValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'analysis-123' }]),
    });
    vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

    const values = nutrition({
      calories: 220,
      proteinGrams: 20,
      carbsGrams: 24,
      fatGrams: 7,
      fiberGrams: 10,
      sodiumMg: 200,
      calciumMg: 150,
      ironMg: 3,
      magnesiumMg: 40,
      phosphorusMg: 90,
      potassiumMg: 300,
      zincMg: 4,
      copperMcg: 120,
      manganeseMg: 1.2,
      betaCaroteneMcg: 80,
      vitaminAMcg: 100,
      vitaminCMg: 15,
      vitaminDMcg: 2.5,
      vitaminEMg: 6,
      vitaminKMcg: 20,
      vitaminB1Mg: 0.5,
      vitaminB2Mg: 0.6,
      vitaminPpMg: 7,
      vitaminB5Mg: 2,
      vitaminB6Mg: 0.7,
      vitaminB9Mcg: 100,
      vitaminB12Mcg: 2,
      vitaminHMcg: 10,
    });
    const label = servingLabel(values, {
      productName: 'Protein Drink',
      servingSize: { value: 330, unit: 'ml' },
      servingSizeDescription: '1 bottle (330 ml)',
      confidence: 'medium',
    });
    let staging: ReturnType<typeof stageOcrMealAction> | undefined;
    const onConfirm = vi.fn((payload: OcrReviewPayload) => {
      staging = stageOcrMealAction({
        ...payload,
        loggedDate: '2026-08-06',
        timezoneOffset: -420,
      });
    });

    render(
      createElement(OcrReviewStep, {
        data: label,
        isStaging: false,
        onBack: vi.fn(),
        onConfirm,
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(await staging).toEqual({
      success: true,
      analysisId: 'analysis-123',
    });

    const inserted = mockValues.mock.calls[0][0];
    const persisted = inserted.pipelineResult.displayedNutrition;
    expect(persisted).toMatchObject({
      magnesiumMg: 40,
      phosphorusMg: 90,
      zincMg: 4,
      copperMcg: 120,
      manganeseMg: 1.2,
      betaCaroteneMcg: 80,
      vitaminEMg: 6,
      vitaminKMcg: 20,
      vitaminB1Mg: 0.5,
      vitaminB2Mg: 0.6,
      vitaminPpMg: 7,
      vitaminB5Mg: 2,
      vitaminB6Mg: 0.7,
      vitaminB9Mcg: 100,
      vitaminB12Mcg: 2,
      vitaminHMcg: 10,
    });
    expect(inserted.pipelineResult.confidenceOverall).toBe('medium');
    expect(inserted.pipelineResult.mealItems[0].ingredients[0]).toMatchObject({
      estimatedGrams: 330,
      userFacingUnit: 'ml',
    });
    expect(inserted.rawInput).toBe('Protein Drink (330ml)');
  });
});
