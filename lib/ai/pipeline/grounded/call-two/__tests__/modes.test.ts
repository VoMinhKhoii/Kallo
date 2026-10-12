import { afterEach, describe, expect, it } from 'vitest';
import {
  CALL2_RUN_DEADLINE_MS,
  chunkedPhaseBudgetMs,
} from '@/lib/ai/pipeline/grounded/call-two/modes';

afterEach(() => {
  delete process.env.PIPELINE_CALL2_PHASE_DEADLINE_MS;
});

describe('chunkedPhaseBudgetMs', () => {
  const t0 = 1_000_000;

  it('keeps the full phase deadline when the run has time for it', () => {
    // 2 s into the run: 43 s left before the run deadline, more than 40 s.
    expect(chunkedPhaseBudgetMs(t0, t0 + 2_000)).toBe(40_000);
  });

  it('ends the phase by the run deadline when Call 1 and matching ran long', () => {
    // 20 s into the run: the phase must end at 45 s, so 25 s, not 40 s.
    expect(chunkedPhaseBudgetMs(t0, t0 + 20_000)).toBe(
      CALL2_RUN_DEADLINE_MS - 20_000
    );
  });

  it('never gives the phase under a second', () => {
    expect(chunkedPhaseBudgetMs(t0, t0 + 50_000)).toBe(1_000);
  });

  it('honours a shorter phase deadline override', () => {
    process.env.PIPELINE_CALL2_PHASE_DEADLINE_MS = '5000';
    expect(chunkedPhaseBudgetMs(t0, t0 + 20_000)).toBe(5_000);
  });
});
