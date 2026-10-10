import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type {
  GeminiClient,
  StreamOptions,
  StructuredOutputParams,
} from '../../types';
import {
  type ClaudeStructuredOutput,
  isClaudeModel,
  withClaudeRouting,
} from '../routing';

const params = (
  model: string,
  extra: Partial<StructuredOutputParams<unknown>> = {}
) =>
  ({
    schema: z.unknown(),
    systemPrompt: 's',
    userMessage: 'u',
    model,
    ...extra,
  }) as StructuredOutputParams<unknown>;

function gemini(): GeminiClient {
  return {
    generateStructuredOutput: vi.fn(async (p) => ({
      by: 'gemini',
      model: p.model,
    })),
    generateStructuredOutputStream: vi.fn(async (p) => ({
      by: 'gemini-stream',
      model: p.model,
    })),
    generateEmbedding: vi.fn(async () => [1]),
    generateEmbeddingBatch: vi.fn(async () => [[1]]),
  } as unknown as GeminiClient;
}

function claude(fail?: Error): ClaudeStructuredOutput {
  const run = vi.fn(async (p: StructuredOutputParams<unknown>) => {
    if (fail) throw fail;
    return { by: 'claude', model: p.model };
  });
  return {
    generateStructuredOutput: run,
    generateStructuredOutputStream: run,
  } as unknown as ClaudeStructuredOutput;
}

const FALLBACK = 'gemini-3.1-flash-lite';
beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));

describe('withClaudeRouting', () => {
  it('sends Claude models to Claude and keeps every other call on Gemini', async () => {
    const llm = withClaudeRouting(gemini(), claude(), {
      fallbackModel: FALLBACK,
    });
    expect(
      await llm.generateStructuredOutputStream(params('claude-haiku-5-5'))
    ).toEqual({ by: 'claude', model: 'claude-haiku-5-5' });
    expect(
      await llm.generateStructuredOutput(params('gemini-3.1-flash-lite'))
    ).toEqual({ by: 'gemini', model: 'gemini-3.1-flash-lite' });
  });

  it('re-runs a failed Claude call on the Gemini fallback model', async () => {
    const err = Object.assign(new Error('overloaded'), { status: 529 });
    const llm = withClaudeRouting(gemini(), claude(err), {
      fallbackModel: FALLBACK,
    });
    expect(
      await llm.generateStructuredOutputStream(params('claude-haiku-5-5'))
    ).toEqual({ by: 'gemini-stream', model: FALLBACK });
  });

  it("numbers the fallback attempts after Claude's, so callers reset their parsers", async () => {
    const claudeTwice = {
      generateStructuredOutputStream: vi.fn(
        async (_p: unknown, o?: StreamOptions) => {
          o?.onAttemptStart?.(1);
          o?.onAttemptStart?.(2);
          throw new Error('schema slip twice');
        }
      ),
    } as unknown as ClaudeStructuredOutput;
    const g = gemini();
    vi.mocked(g.generateStructuredOutputStream).mockImplementation(
      async (p, o) => {
        o?.onAttemptStart?.(1);
        o?.onAttemptComplete?.({
          attempt: 1,
          model: p.model,
          error: null,
          inputTokens: 1,
          outputTokens: 1,
          cachedTokens: 0,
          thoughtTokens: 0,
        });
        return {} as never;
      }
    );
    const starts: number[] = [];
    const completes: number[] = [];
    const llm = withClaudeRouting(g, claudeTwice, { fallbackModel: FALLBACK });
    await llm.generateStructuredOutputStream(params('claude-haiku-5-5'), {
      onAttemptStart: (n) => starts.push(n),
      onAttemptComplete: (m) => completes.push(m.attempt),
    });

    expect(starts).toEqual([1, 2, 3]);
    expect(completes).toEqual([3]);
  });

  it('does not re-run a call its caller aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const llm = withClaudeRouting(gemini(), claude(new Error('aborted')), {
      fallbackModel: FALLBACK,
    });
    await expect(
      llm.generateStructuredOutput(
        params('claude-haiku-5-5', { abortSignal: controller.signal })
      )
    ).rejects.toThrow('aborted');
  });

  it('runs Claude models on Gemini when there is no Claude client (no API key)', async () => {
    const llm = withClaudeRouting(gemini(), null, { fallbackModel: FALLBACK });
    expect(
      await llm.generateStructuredOutput(params('claude-haiku-5-5'))
    ).toEqual({ by: 'gemini', model: FALLBACK });
  });

  it('keeps image calls and embeddings on Gemini', async () => {
    const g = gemini();
    const llm = withClaudeRouting(g, claude(), { fallbackModel: FALLBACK });
    const image = { mimeType: 'image/png', base64Data: 'AA==' };
    expect(
      await llm.generateStructuredOutput(params('claude-haiku-5-5', { image }))
    ).toEqual({ by: 'gemini', model: FALLBACK });
    await llm.generateEmbeddingBatch(['x']);
    expect(g.generateEmbeddingBatch).toHaveBeenCalledWith(['x']);
  });

  it('recognizes Claude model ids', () => {
    expect(isClaudeModel('claude-haiku-5-5')).toBe(true);
    expect(isClaudeModel('gemini-3.1-flash-lite')).toBe(false);
  });
});
