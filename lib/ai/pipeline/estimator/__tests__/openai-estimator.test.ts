import { describe, expect, it } from 'vitest';
import {
  createOpenAiEstimator,
  OPENAI_ESTIMATOR_MODEL,
} from '../openai-estimator';
import { input } from './fixtures/estimator-input';

// ---------------------------------------------------------------------------
// D3: stub adapter throws the documented "not yet wired" error
// ---------------------------------------------------------------------------

describe('stub adapter — OpenAI throws until wired', () => {
  it('the OpenAI stub throws a clear "not yet wired" error', () => {
    const openai = createOpenAiEstimator();
    expect(openai.id).toBe('openai');
    expect(openai.model).toBe(OPENAI_ESTIMATOR_MODEL);
    expect(() => openai.estimate(input, new AbortController().signal)).toThrow(
      /not yet wired/i
    );
  });
});
