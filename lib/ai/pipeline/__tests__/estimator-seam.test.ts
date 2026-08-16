import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini } from '../../__tests__/test-helpers';
import type { MealItemWithCandidates } from '../../prompts/grounded-estimation';
import { buildGroundedEstimationPrompt } from '../../prompts/grounded-estimation';
import {
  CLAUDE_ESTIMATOR_MODEL,
  createClaudeEstimator,
} from '../estimator/claude-estimator';
import {
  createGeminiEstimator,
  GROUNDED_ESTIMATION_USER_MESSAGE,
  getGroundedEstimationUserMessage,
  renderGeminiEstimatorPrompt,
} from '../estimator/gemini-estimator';
import {
  createOpenAiEstimator,
  OPENAI_ESTIMATOR_MODEL,
} from '../estimator/openai-estimator';
import {
  ESTIMATOR_NAMES,
  ESTIMATOR_PRICING,
  estimatorCostUsd,
  isEstimatorName,
  selectEstimator,
} from '../estimator/select';
import type { GroundedEstimatorInput } from '../estimator/types';
import type { GroundedEstimation } from '../schemas-v2';

const mealItems: MealItemWithCandidates[] = [
  {
    mealItem: {
      name: 'ức gà luộc',
      cookingMethod: 'luộc',
      ingredients: [{ rawName: 'ức gà', canonicalName: 'Ức gà' }],
    },
    ingredients: [
      {
        ingredient: { rawName: 'ức gà', canonicalName: 'Ức gà' },
        candidates: [
          {
            id: 'c1',
            similarity: 1,
            dbName: 'Ức gà',
            dbState: 'cooked',
            source: 'fao',
            per100gKcal: 165,
            per100gProteinG: 31,
            per100gCarbohydrateG: 0,
            per100gFatG: 3.6,
            inediblePct: 0,
          },
        ],
        resolvedGramsAnchor: 150,
      },
    ],
  },
];

const input: GroundedEstimatorInput = {
  originalPrompt: '150g ức gà luộc',
  mealItems,
  userContext: {
    countryOfOrigin: 'Vietnam',
    countryOfResidence: 'Vietnam',
    inputLanguage: 'vi',
    outputLanguage: 'vi',
    cookingHabits: {
      oilUsage: 'normal',
      defaultRicePortion: 'medium',
      defaultProteinPortion: 'medium',
      sugarBraised: 'medium',
      brothConsumption: 'some',
    },
  },
  temperature: 0.4,
};

const CALL2: GroundedEstimation = {
  mealItems: [
    {
      mealItemName: 'ức gà luộc',
      ingredients: [
        {
          ingredientName: 'ức gà',
          selectedCandidateId: 'c1',
          grossG: 150,
          refusePct: 0,
          caloriesKcal: { low: 240, mid: 250, high: 260 },
          proteinG: { low: 44, mid: 46, high: 48 },
          carbohydrateG: { low: 0, mid: 0, high: 0 },
          fatG: { low: 5, mid: 5.4, high: 6 },
        },
      ],
    },
  ],
};

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// D3: Gemini adapter — behavior-preserving round trip (golden)
// ---------------------------------------------------------------------------

describe('createGeminiEstimator — round-trips the pre-refactor call identically', () => {
  it('asks for grossG/refusePct in the user message', () => {
    expect(getGroundedEstimationUserMessage()).toContain(
      'estimate grossG then refusePct'
    );
    expect(getGroundedEstimationUserMessage()).not.toContain(
      'estimate grams scoped'
    );
  });

  it('calls generateStructuredOutputStream with the SAME prompt, model, message, and knobs', async () => {
    const gemini = createMockGemini({
      generateStructuredOutputStream: vi.fn().mockResolvedValue(CALL2),
    });
    const estimator = createGeminiEstimator(gemini, 'gemini-3-flash');
    expect(estimator.id).toBe('gemini');
    expect(estimator.model).toBe('gemini-3-flash');

    const controller = new AbortController();
    const onChunk = vi.fn();
    const onAttemptStart = vi.fn();
    const result = await estimator.estimate(input, controller.signal, {
      onChunk,
      onAttemptStart,
    });

    expect(result.estimation).toEqual(CALL2);

    // The adapter passed EXACTLY the pre-refactor request shape.
    const call = (
      gemini.generateStructuredOutputStream as unknown as ReturnType<
        typeof vi.fn
      >
    ).mock.calls[0];
    const request = call[0];
    const opts = call[1];
    expect(request.systemPrompt).toBe(
      buildGroundedEstimationPrompt({
        originalPrompt: input.originalPrompt,
        mealItems: input.mealItems,
        userContext: input.userContext,
      })
    );
    expect(request.userMessage).toBe(GROUNDED_ESTIMATION_USER_MESSAGE);
    expect(request.model).toBe('gemini-3-flash');
    expect(request.temperature).toBe(0.4);
    expect(request.topP).toBe(1);
    expect(request.topK).toBe(1);
    expect(request.abortSignal).toBe(controller.signal);
    // Streaming hooks forwarded through.
    expect(opts.onChunk).toBe(onChunk);
    expect(opts.onAttemptStart).toBe(onAttemptStart);
  });

  it('renderGeminiEstimatorPrompt matches the adapter system prompt byte-for-byte', () => {
    const rendered = renderGeminiEstimatorPrompt(input);
    expect(rendered).toBe(
      buildGroundedEstimationPrompt({
        originalPrompt: input.originalPrompt,
        mealItems: input.mealItems,
        userContext: input.userContext,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// D3: stub adapters throw the documented "not yet wired" error
// ---------------------------------------------------------------------------

describe('stub adapters — Claude / OpenAI throw until wired', () => {
  it('the Claude stub throws a clear "not yet wired" error naming the SDK + model', () => {
    const claude = createClaudeEstimator();
    expect(claude.id).toBe('claude');
    expect(claude.model).toBe(CLAUDE_ESTIMATOR_MODEL);
    expect(CLAUDE_ESTIMATOR_MODEL).toBe('claude-haiku-4-5');
    expect(() => claude.estimate(input, new AbortController().signal)).toThrow(
      /not yet wired/i
    );
    expect(() => claude.estimate(input, new AbortController().signal)).toThrow(
      /@anthropic-ai\/sdk/
    );
  });

  it('the OpenAI stub throws a clear "not yet wired" error', () => {
    const openai = createOpenAiEstimator();
    expect(openai.id).toBe('openai');
    expect(openai.model).toBe(OPENAI_ESTIMATOR_MODEL);
    expect(() => openai.estimate(input, new AbortController().signal)).toThrow(
      /not yet wired/i
    );
  });
});

// ---------------------------------------------------------------------------
// D3: selector + pricing table for the bakeoff harness
// ---------------------------------------------------------------------------

describe('selectEstimator + pricing', () => {
  it('selects the Gemini adapter for "gemini" and the stubs for the others', () => {
    const gemini = createMockGemini({});
    const deps = { gemini, geminiModel: 'gemini-3-flash' };
    expect(selectEstimator('gemini', deps).id).toBe('gemini');
    expect(selectEstimator('claude', deps).id).toBe('claude');
    expect(selectEstimator('openai', deps).id).toBe('openai');
  });

  it('isEstimatorName validates the CLI flag values', () => {
    expect(isEstimatorName('gemini')).toBe(true);
    expect(isEstimatorName('claude')).toBe(true);
    expect(isEstimatorName('bogus')).toBe(false);
    for (const name of ESTIMATOR_NAMES)
      expect(isEstimatorName(name)).toBe(true);
  });

  it('has a pricing entry for every estimator and computes token cost', () => {
    for (const name of ESTIMATOR_NAMES) {
      const p = ESTIMATOR_PRICING[name];
      expect(p.inputPerMTokUsd).toBeGreaterThan(0);
      expect(p.outputPerMTokUsd).toBeGreaterThan(0);
    }
    // 1M input + 1M output tokens for gemini = input rate + output rate.
    const cost = estimatorCostUsd('gemini', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(
      ESTIMATOR_PRICING.gemini.inputPerMTokUsd +
        ESTIMATOR_PRICING.gemini.outputPerMTokUsd,
      6
    );
  });
});
