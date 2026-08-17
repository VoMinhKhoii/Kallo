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
import { OcrReviewStep } from '@/components/logging/input/ocr-review-step';
import type {
  NutritionValues as OcrNutritionValues,
  OcrReviewPayload,
  ParsedNutritionLabel,
} from '@/lib/domain/nutrition/ocr-schema';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/infra/db', () => ({
  db: {
    insert: vi.fn(),
  },
}));

const { mockRequireAuthAndProfile, mockUser } = vi.hoisted(() => ({
  mockRequireAuthAndProfile: vi.fn(),
  mockUser: { id: 'user-123', email: 'test@example.com' },
}));

vi.mock('@/lib/infra/auth/session', () => ({
  requireAuthAndProfile: mockRequireAuthAndProfile,
}));

vi.mock('@/lib/ai/pipeline/estimator/label-ocr/label-ocr', () => ({
  scanNutritionLabelWithGemini: vi.fn(),
}));

import {
  scanNutritionLabelAction,
  stageOcrMealAction,
} from '@/lib/actions/logging/nutrition-ocr';
import { scanNutritionLabelWithGemini } from '@/lib/ai/pipeline/estimator/label-ocr/label-ocr';
import { OCR_MAX_IMAGE_BYTES } from '@/lib/domain/nutrition/ocr-image-constants';

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

describe('scanNutritionLabelAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthAndProfile.mockResolvedValue({
      user: mockUser,
      profile: { goal: 'cutting', aggression: '0.5' },
    });
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

  it('rejects oversized input before auth or Gemini', async () => {
    const oversizedBase64 = 'A'.repeat(
      Math.ceil(((OCR_MAX_IMAGE_BYTES + 1) * 4) / 3 / 4) * 4
    );

    expect(
      await scanNutritionLabelAction({
        imageBase64: oversizedBase64,
        mimeType: 'image/png',
      })
    ).toEqual({ success: false, code: 'invalid_image' });
    expect(mockRequireAuthAndProfile).not.toHaveBeenCalled();
    expect(scanNutritionLabelWithGemini).not.toHaveBeenCalled();
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

    const confirm = screen.getByRole('button', { name: 'confirm' });
    expect(confirm).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('ocrNutrients.protein (g)'), {
      target: { value: '3,5' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('ocrRequiredValues');
    fireEvent.change(screen.getByLabelText('ocrNutrients.carbohydrates (g)'), {
      target: { value: '20' },
    });
    fireEvent.change(screen.getByLabelText('ocrNutrients.fat (g)'), {
      target: { value: '4' },
    });
    expect(confirm).toBeEnabled();

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
    const { db } = await import('@/lib/infra/db');
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
