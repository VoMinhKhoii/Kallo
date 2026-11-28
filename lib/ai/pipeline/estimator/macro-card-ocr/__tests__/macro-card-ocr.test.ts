import { ThinkingLevel } from '@google/genai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toProviderJsonSchema } from '@/lib/ai/prompts/schema';
import { toClaudeSchema } from '@/lib/ai/provider/claude/schema';

const { mockGenerateStructuredOutput, mockCreatePipelineLlm } = vi.hoisted(
  () => {
    const mockGenerateStructuredOutput = vi.fn();
    const mockCreatePipelineLlm = vi.fn(() => ({
      generateStructuredOutput: mockGenerateStructuredOutput,
    }));
    return { mockGenerateStructuredOutput, mockCreatePipelineLlm };
  }
);

vi.mock('@/lib/ai/provider/provider', () => ({
  resolveGeminiProvider: vi.fn(() => ({
    provider: 'aistudio',
    apiKey: 'test-key',
  })),
  createPipelineLlm: mockCreatePipelineLlm,
}));

vi.mock('@/lib/ai/pipeline/telemetry/budget', () => ({
  MACRO_CARD_OCR_BUDGET_ROUTE: 'macro-card-ocr',
  createBudgetAttemptRecorder: vi.fn(() => vi.fn()),
}));

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));

import {
  MACRO_CARD_OCR_FALLBACK_MODEL,
  MACRO_CARD_OCR_MODEL,
  rawMacroCardOcrSchema,
  scanMacroCardWithGemini,
} from '../macro-card-ocr';

describe('scanMacroCardWithGemini', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('produces a flat root object schema accepted by Anthropic structured outputs', () => {
    const claudeSchema = toClaudeSchema(
      toProviderJsonSchema(rawMacroCardOcrSchema, { mode: 'slim' })
    ) as Record<string, unknown>;

    expect(claudeSchema.type).toBe('object');
    expect(claudeSchema.anyOf).toBeUndefined();
    expect(claudeSchema.additionalProperties).toBe(false);
  });

  it('runs Claude Haiku 5.5 primary with Gemini 3.1 Flash-Lite MINIMAL fallback and reports resolved model', async () => {
    mockGenerateStructuredOutput.mockImplementation(async (params, opts) => {
      opts?.onAttemptComplete?.({
        attempt: 1,
        model: params.model,
        error: null,
        inputTokens: 800,
        outputTokens: 120,
        cachedTokens: 0,
        cacheWriteTokens: 0,
        thoughtTokens: 0,
        latencyMs: 900,
      });
      return {
        cardDetected: true,
        itemName: 'Chicken Bowl',
        evidence: '450 kcal P 38g C 42g F 12g',
        calories: { value: '450', unit: 'kcal' },
        proteinGrams: { value: '38', unit: 'g' },
        carbsGrams: { value: '42', unit: 'g' },
        fatGrams: { value: '12', unit: 'g' },
        confidence: 'high',
      };
    });

    const resolved: string[] = [];
    const result = await scanMacroCardWithGemini({
      imageBase64: '/9j/4AAQ',
      mimeType: 'image/jpeg',
      onModelResolved: (m) => resolved.push(m),
    });

    expect(MACRO_CARD_OCR_MODEL).toBe('claude-haiku-5-5');
    expect(MACRO_CARD_OCR_FALLBACK_MODEL).toBe('gemini-3.1-flash-lite');
    expect(mockCreatePipelineLlm).toHaveBeenCalledWith(expect.any(Object), {
      fallbackModel: 'gemini-3.1-flash-lite',
    });
    expect(mockGenerateStructuredOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-5-5',
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        image: { mimeType: 'image/jpeg', base64Data: '/9j/4AAQ' },
      }),
      expect.any(Object)
    );
    expect(resolved).toEqual(['claude-haiku-5-5']);
    expect(result.basis).toBe('per_serving');
    if (result.basis === 'per_serving') {
      expect(result.perServing.calories).toBe(450);
    }
  });

  it('reports the fallback Gemini model when Claude fails and Gemini succeeds', async () => {
    mockGenerateStructuredOutput.mockImplementation(async (_params, opts) => {
      opts?.onAttemptComplete?.({
        attempt: 1,
        model: 'claude-haiku-5-5',
        error: new Error('overloaded'),
        inputTokens: null,
        outputTokens: null,
        cachedTokens: null,
        cacheWriteTokens: null,
        thoughtTokens: null,
        latencyMs: 250,
      });
      opts?.onAttemptComplete?.({
        attempt: 2,
        model: 'gemini-3.1-flash-lite',
        fallbackFrom: 'claude-haiku-5-5',
        error: null,
        inputTokens: 900,
        outputTokens: 110,
        cachedTokens: 0,
        cacheWriteTokens: 0,
        thoughtTokens: 0,
        latencyMs: 1200,
      });
      return {
        cardDetected: true,
        itemName: 'Loaded Miso Soup',
        evidence: '137 kcal',
        calories: { value: '137', unit: 'kcal' },
        proteinGrams: null,
        carbsGrams: null,
        fatGrams: null,
        confidence: 'high',
      };
    });

    const resolved: string[] = [];
    await scanMacroCardWithGemini({
      imageBase64: '/9j/4AAQ',
      mimeType: 'image/jpeg',
      onModelResolved: (m) => resolved.push(m),
    });

    expect(resolved).toEqual(['gemini-3.1-flash-lite']);
  });
});
