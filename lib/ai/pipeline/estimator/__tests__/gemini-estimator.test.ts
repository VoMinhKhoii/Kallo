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
