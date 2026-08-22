import { describe, expect, it } from 'vitest';
import {
  CLAUDE_ESTIMATOR_MODEL,
  createClaudeEstimator,
} from '../claude-estimator';
import { input } from './fixtures/estimator-input';

// ---------------------------------------------------------------------------
// D3: stub adapter throws the documented "not yet wired" error
// ---------------------------------------------------------------------------

describe('stub adapter — Claude throws until wired', () => {
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
});
