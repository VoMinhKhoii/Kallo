import { describe, expect, it, vi } from 'vitest';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import {
  costPer1kCases,
  createCaseUsage,
  summarizeAttempts,
  withUsageCapture,
} from '../eval-usage';

function fakeClient(tokens: number): GeminiClient {
  return {
    generateStructuredOutput: vi.fn(),
    generateStructuredOutputStream: vi.fn(async (_params, opts) => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
      opts?.onAttemptComplete?.({
        attempt: 1,
        model: 'gemini-3.1-flash-lite',
        inputTokens: tokens,
        outputTokens: 10,
        cachedTokens: null,
        thoughtTokens: null,
        error: null,
      });
      return {} as never;
    }),
    generateEmbedding: vi.fn(),
    generateEmbeddingBatch: vi.fn(),
  };
}

describe('eval usage capture', () => {
  it('attributes concurrent cases their own attempts', async () => {
    const client = withUsageCapture(fakeClient(100));
    const a = createCaseUsage();
    const b = createCaseUsage();
    const call = () =>
      client.generateStructuredOutputStream(
        { schema: {} as never, systemPrompt: '', userMessage: '', model: '' },
        {}
      );

    await Promise.all([
      a.run(async () => {
        await call();
        await call();
      }),
      b.run(call),
    ]);

    expect(a.summary()).toMatchObject({ calls: 2, inputTokens: 200 });
    expect(b.summary()).toMatchObject({ calls: 1, inputTokens: 100 });
  });

  it('keeps the caller-supplied attempt hook working', async () => {
    const own = vi.fn();
    const client = withUsageCapture(fakeClient(5));
    await createCaseUsage().run(() =>
      client.generateStructuredOutputStream(
        { schema: {} as never, systemPrompt: '', userMessage: '', model: '' },
        { onAttemptComplete: own }
      )
    );
    expect(own).toHaveBeenCalledOnce();
  });

  it('reports cost per 1k cases, or null when a model has no rate', () => {
    const priced = summarizeAttempts([
      {
        model: 'gemini-3.1-flash-lite',
        inputTokens: 1000,
        outputTokens: 0,
        cachedTokens: null,
        thoughtTokens: null,
      },
    ]);
    expect(costPer1kCases([{ usage: priced }])).toBeCloseTo(0.25, 9);

    const unpriced = summarizeAttempts([
      {
        model: 'mystery',
        inputTokens: 1,
        outputTokens: 1,
        cachedTokens: null,
        thoughtTokens: null,
      },
    ]);
    expect(unpriced.costUsd).toBeNull();
    expect(costPer1kCases([{ usage: priced }, { usage: unpriced }])).toBeNull();
  });
});
