import { describe, expect, it } from 'vitest';
import {
  buildStagesWithCalls,
  computeCompareDiff,
  parsePromptVersionsUsed,
  type StageWithCalls,
} from '../request-trace';

/**
 * Characterization of the three pure helpers the request-detail page uses to
 * shape one trace before rendering. They are the whole reason the page is
 * 276 lines; pinning them here is what makes lifting them out safe.
 */

function stageWith(
  stageIndex: number,
  outputJson: unknown,
  id = `sl-${stageIndex}`
): StageWithCalls {
  return {
    stage: {
      id,
      requestId: 'req-1',
      stage: `stage-${stageIndex}`,
      stageIndex,
      inputJson: null,
      outputJson,
      status: 'success',
      error: null,
      durationMs: 1,
      createdAt: new Date(0),
    },
    calls: [],
  } as unknown as StageWithCalls;
}

describe('parsePromptVersionsUsed', () => {
  it('accepts a flat string record', () => {
    expect(parsePromptVersionsUsed({ decomposition: 'pv-1' })).toEqual({
      decomposition: 'pv-1',
    });
  });

  it('maps null and undefined to null', () => {
    expect(parsePromptVersionsUsed(null)).toBeNull();
    expect(parsePromptVersionsUsed(undefined)).toBeNull();
  });

  it('rejects a non-string-valued or non-object blob rather than throwing', () => {
    expect(parsePromptVersionsUsed({ decomposition: 3 })).toBeNull();
    expect(parsePromptVersionsUsed('nope')).toBeNull();
    expect(parsePromptVersionsUsed([1, 2, 3])).toBeNull();
  });

  it('passes an empty object through as an empty record', () => {
    expect(parsePromptVersionsUsed({})).toEqual({});
  });
});

describe('buildStagesWithCalls', () => {
  it('joins llmCalls onto their stage by stageLogId', () => {
    const detail = {
      stageLogs: [{ id: 'a' }, { id: 'b' }],
      llmCalls: [
        { id: 'c1', stageLogId: 'a' },
        { id: 'c2', stageLogId: 'b' },
        { id: 'c3', stageLogId: 'a' },
      ],
    };
    const joined = buildStagesWithCalls(
      detail as unknown as Parameters<typeof buildStagesWithCalls>[0]
    );
    expect(joined).toHaveLength(2);
    expect(joined[0].calls.map((c) => c.id)).toEqual(['c1', 'c3']);
    expect(joined[1].calls.map((c) => c.id)).toEqual(['c2']);
  });

  it('leaves a stage with no matching calls empty rather than dropping it', () => {
    const joined = buildStagesWithCalls({
      stageLogs: [{ id: 'a' }],
      llmCalls: [{ id: 'c1', stageLogId: 'other' }],
    } as unknown as Parameters<typeof buildStagesWithCalls>[0]);
    expect(joined).toHaveLength(1);
    expect(joined[0].calls).toEqual([]);
  });
});

describe('computeCompareDiff', () => {
  it('labels a stage unchanged when outputs match regardless of key order', () => {
    const { left, right } = computeCompareDiff(
      [stageWith(1, { a: 1, b: { c: 2, d: 3 } })],
      [stageWith(1, { b: { d: 3, c: 2 }, a: 1 })]
    );
    expect(left[0].compareLabel).toBe('unchanged');
    expect(right[0].compareLabel).toBe('unchanged');
  });

  it('labels a stage changed when outputs differ', () => {
    const { left, right } = computeCompareDiff(
      [stageWith(1, { a: 1 })],
      [stageWith(1, { a: 2 })]
    );
    expect(left[0].compareLabel).toBe('changed');
    expect(right[0].compareLabel).toBe('changed');
  });

  it('treats array order as significant', () => {
    const { left } = computeCompareDiff(
      [stageWith(1, { xs: [1, 2] })],
      [stageWith(1, { xs: [2, 1] })]
    );
    expect(left[0].compareLabel).toBe('changed');
  });

  it('labels a stage present on only one side as only-here', () => {
    const { left, right } = computeCompareDiff(
      [stageWith(1, { a: 1 })],
      [stageWith(2, { a: 1 })]
    );
    expect(left).toHaveLength(1);
    expect(right).toHaveLength(1);
    expect(left[0].compareLabel).toBe('only-here');
    expect(right[0].compareLabel).toBe('only-here');
  });

  it('emits both sides ordered by stageIndex', () => {
    const { left, right } = computeCompareDiff(
      [stageWith(3, {}), stageWith(1, {})],
      [stageWith(2, {}), stageWith(1, {})]
    );
    expect(left.map((s) => s.stage.stageIndex)).toEqual([1, 3]);
    expect(right.map((s) => s.stage.stageIndex)).toEqual([1, 2]);
  });

  it('preserves the original stage payload alongside the label', () => {
    const { left } = computeCompareDiff(
      [stageWith(1, { a: 1 }, 'keep-me')],
      [stageWith(1, { a: 1 })]
    );
    expect(left[0].stage.id).toBe('keep-me');
  });

  it('handles empty inputs on both sides', () => {
    expect(computeCompareDiff([], [])).toEqual({ left: [], right: [] });
  });
});
