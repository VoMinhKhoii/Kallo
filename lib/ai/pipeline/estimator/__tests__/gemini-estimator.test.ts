import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini } from '@/lib/ai/__fixtures__/test-helpers';
import { buildGroundedEstimationPrompt } from '@/lib/ai/prompts/build/grounded-estimation';
import {
  createGeminiEstimator,
  GROUNDED_ESTIMATION_USER_MESSAGE,
  getGroundedEstimationUserMessage,
  renderGeminiEstimatorPrompt,
} from '../gemini-estimator';
import { CALL2, input } from './fixtures/estimator-input';

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

describe('createGeminiEstimator — lean output guard (the mì gói shape)', () => {
  const triple = (mid: number) => ({ low: mid, mid, high: mid });
  const leanWithUnanchoredNull = {
    mealItems: [
      {
        mealItemName: 'Mì gói',
        ingredients: [
          {
            ingredientName: 'mì gói',
            selectedCandidateId: 'none',
            rejectReason: 'category mismatch',
            grossG: 80,
            refusePct: 0,
            proteinG: null,
            carbohydrateG: null,
            fatG: triple(14),
          },
        ],
      },
    ],
  };
  const strictReply = {
    mealItems: [
      {
        mealItemName: 'Mì gói',
        ingredients: [
          {
            ...leanWithUnanchoredNull.mealItems[0].ingredients[0],
            proteinG: triple(8),
            carbohydrateG: triple(48),
          },
        ],
      },
    ],
  };

  it('re-asks once with the strict schema when an unanchored row has null P/C', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stream = vi
      .fn()
      .mockResolvedValueOnce(leanWithUnanchoredNull)
      .mockResolvedValueOnce(strictReply);
    const gemini = createMockGemini({ generateStructuredOutputStream: stream });
    const estimator = createGeminiEstimator(gemini, 'gemini-3.1-flash-lite');

    const result = await estimator.estimate(
      input,
      new AbortController().signal
    );

    expect(stream).toHaveBeenCalledTimes(2);
    const strictSchema = stream.mock.calls[1][0].schema;
    // The strict schema's decoder contract: null P/C cannot parse.
    expect(strictSchema.safeParse(leanWithUnanchoredNull).success).toBe(false);
    expect(strictSchema.safeParse(strictReply).success).toBe(true);
    expect(
      result.estimation.mealItems[0].ingredients[0].carbohydrateG?.mid
    ).toBe(48);
  });

  it('makes one call when null P/C only sit on accepted matches', async () => {
    const stream = vi.fn().mockResolvedValueOnce({
      mealItems: [
        {
          mealItemName: 'Cơm',
          ingredients: [
            {
              ingredientName: 'cơm',
              selectedCandidateId: 'c1',
              grossG: 200,
              refusePct: 0,
              proteinG: null,
              carbohydrateG: null,
              fatG: triple(0.6),
            },
          ],
        },
      ],
    });
    const gemini = createMockGemini({ generateStructuredOutputStream: stream });
    await createGeminiEstimator(gemini, 'm').estimate(
      input,
      new AbortController().signal
    );
    expect(stream).toHaveBeenCalledTimes(1);
  });
});
