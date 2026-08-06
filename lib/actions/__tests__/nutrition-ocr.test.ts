import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
  },
}));

const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: 'user-123', email: 'test@example.com' },
}));

vi.mock('@/lib/auth', () => ({
  requireAuthAndProfile: vi.fn().mockResolvedValue({
    user: mockUser,
    profile: { goal: 'cutting', aggression: '0.5' },
  }),
}));

vi.mock('@/lib/ai/pipeline/estimator/label-ocr', () => ({
  scanNutritionLabelWithGemini: vi.fn(),
}));

import { scanNutritionLabelAction } from '@/lib/actions/nutrition-ocr';
import { scanNutritionLabelWithGemini } from '@/lib/ai/pipeline/estimator/label-ocr';

describe('scanNutritionLabelAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates input and calls scanNutritionLabelWithGemini', async () => {
    const mockLabelData = {
      productName: 'Mì Hảo Hảo',
      servingSizeGrams: 75,
      basis: 'per_serving' as const,
      perServing: {
        calories: 350,
        proteinGrams: 7.5,
        carbsGrams: 52,
        fatGrams: 12,
      },
      confidence: 'high' as const,
    };

    vi.mocked(scanNutritionLabelWithGemini).mockResolvedValue(mockLabelData);

    const result = await scanNutritionLabelAction({
      imageBase64: 'base64sampleData...',
      mimeType: 'image/jpeg',
    });

    expect(result).toEqual({
      success: true,
      data: mockLabelData,
    });
    expect(scanNutritionLabelWithGemini).toHaveBeenCalledWith({
      imageBase64: 'base64sampleData...',
      mimeType: 'image/jpeg',
    });
  });

  it('returns invalid_image code on bad input mimeType or payload', async () => {
    const result = await scanNutritionLabelAction({
      imageBase64: '',
      mimeType: 'invalid/mime',
    });

    expect(result).toEqual({
      success: false,
      code: 'invalid_image',
    });
  });
});

describe('stageOcrMealAction', () => {
  it('stores all DB-backed micronutrients into pendingAnalyses pipeline result', async () => {
    const { db } = await import('@/lib/db');
    const { stageOcrMealAction } = await import('@/lib/actions/nutrition-ocr');

    const mockValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'analysis-123' }]),
    });
    vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

    const result = await stageOcrMealAction({
      productName: 'Protein Bar',
      grams: 60,
      calories: 220,
      proteinGrams: 20,
      carbsGrams: 24,
      fatGrams: 7,
      fiberGrams: 10,
      sodiumMg: 200,
      calciumMg: 150,
      ironMg: 3,
      potassiumMg: 300,
      vitaminAMcg: 100,
      vitaminCMg: 15,
      vitaminDMcg: 2.5,
      loggedDate: '2026-08-06',
      timezoneOffset: -420,
    });

    expect(result).toEqual({ success: true, analysisId: 'analysis-123' });
    expect(mockValues).toHaveBeenCalled();
    const insertedObj = mockValues.mock.calls[0][0];
    const nutrition = insertedObj.pipelineResult.displayedNutrition;

    expect(nutrition.fiberG).toBe(10);
    expect(nutrition.sodiumMg).toBe(200);
    expect(nutrition.calciumMg).toBe(150);
    expect(nutrition.ironMg).toBe(3);
    expect(nutrition.potassiumMg).toBe(300);
    expect(nutrition.vitaminAMcg).toBe(100);
    expect(nutrition.vitaminCMg).toBe(15);
    expect(nutrition.vitaminDMcg).toBe(2.5);
  });
});
