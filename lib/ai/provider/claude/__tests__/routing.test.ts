import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type {
  GeminiClient,
  StreamOptions,
  StructuredOutputParams,
} from '../../types';
import {
  __resetClaudeForTests,
  type ClaudeStructuredOutput,
  getVertexClaudeStructuredOutput,
  isClaudeModel,
  withClaudeRouting,
} from '../routing';

const vertexSdk = vi.hoisted(() => ({
  AnthropicVertex: vi.fn(function (this: { messages: unknown }) {
    this.messages = {
      stream: () => {
        throw new Error('stream reached');
      },
    };
  }),
}));
vi.mock('@anthropic-ai/vertex-sdk', () => vertexSdk);

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

describe('getVertexClaudeStructuredOutput', () => {
  const onVertex = (project: string) =>
    ({ provider: 'vertex', project, location: 'global' }) as const;
  beforeEach(() => {
    __resetClaudeForTests();
    vertexSdk.AnthropicVertex.mockClear();
  });

  it('is off unless the app runs on Vertex, whatever ran before', () => {
    getVertexClaudeStructuredOutput(onVertex('p'));
    expect(
      getVertexClaudeStructuredOutput({ provider: 'ai-studio', apiKey: 'k' })
    ).toBeNull();
  });

  it('signs nothing in until a call reaches this step', async () => {
    const step = getVertexClaudeStructuredOutput(onVertex('p'));
    expect(vertexSdk.AnthropicVertex).not.toHaveBeenCalled();
    await expect(
      step?.generateStructuredOutput(params('claude-haiku-5-5'))
    ).rejects.toThrow('stream reached');
    expect(vertexSdk.AnthropicVertex).toHaveBeenCalledTimes(1);
  });

  it('keeps one client per project, each billing its own', async () => {
    for (const project of ['a', 'a', 'b'])
      await getVertexClaudeStructuredOutput(onVertex(project))
        ?.generateStructuredOutput(params('claude-haiku-5-5'))
        .catch(() => undefined);
    expect(
      vertexSdk.AnthropicVertex.mock.calls.map(
        ([o]: unknown[]) => (o as { projectId: string }).projectId
      )
    ).toEqual(['a', 'b']);
  });
});

describe('the Claude waterfall', () => {
  const outOfCredits = () =>
    new Anthropic.APIError(
      400,
      { error: { type: 'invalid_request_error' } },
      'Your credit balance is too low',
      undefined
    );
  const vertex = (fail?: Error) => {
    const run = vi.fn(async (p: StructuredOutputParams<unknown>) => {
      if (fail) throw fail;
      return { by: 'vertex', model: p.model };
    });
    return {
      generateStructuredOutput: run,
      generateStructuredOutputStream: run,
    } as unknown as ClaudeStructuredOutput;
  };

  it('moves an API failure to Vertex, on the same Claude model', async () => {
    const llm = withClaudeRouting(gemini(), claude(outOfCredits()), {
      fallbackModel: FALLBACK,
      vertexClaude: vertex(),
    });
    expect(
      await llm.generateStructuredOutputStream(params('claude-haiku-5-5'))
    ).toEqual({ by: 'vertex', model: 'claude-haiku-5-5' });
  });

  it('never reaches Vertex when the Claude API answers', async () => {
    const onVertex = vertex();
    const llm = withClaudeRouting(gemini(), claude(), {
      fallbackModel: FALLBACK,
      vertexClaude: onVertex,
    });
    await llm.generateStructuredOutput(params('claude-haiku-5-5'));
    expect(onVertex.generateStructuredOutput).not.toHaveBeenCalled();
  });

  it('ends on Gemini when Vertex fails too (no quota yet)', async () => {
    const noQuota = new Anthropic.APIError(
      429,
      undefined,
      'Quota exceeded',
      undefined
    );
    const llm = withClaudeRouting(gemini(), claude(outOfCredits()), {
      fallbackModel: FALLBACK,
      vertexClaude: vertex(noQuota),
    });
    expect(
      await llm.generateStructuredOutputStream(params('claude-haiku-5-5'))
    ).toEqual({ by: 'gemini-stream', model: FALLBACK });
  });

  it('skips Vertex on a bad answer: the same model would repeat it', async () => {
    const slip = Object.assign(new Error('bad shape'), { name: 'ZodError' });
    const onVertex = vertex();
    const llm = withClaudeRouting(gemini(), claude(slip), {
      fallbackModel: FALLBACK,
      vertexClaude: onVertex,
    });
    expect(
      await llm.generateStructuredOutputStream(params('claude-haiku-5-5'))
    ).toEqual({ by: 'gemini-stream', model: FALLBACK });
    expect(onVertex.generateStructuredOutputStream).not.toHaveBeenCalled();
  });

  it('starts on Vertex without an Anthropic key', async () => {
    const llm = withClaudeRouting(gemini(), null, {
      fallbackModel: FALLBACK,
      vertexClaude: vertex(),
    });
    expect(
      await llm.generateStructuredOutputStream(params('claude-haiku-5-5'))
    ).toEqual({ by: 'vertex', model: 'claude-haiku-5-5' });
  });

  it('keeps numbering attempts down the whole waterfall', async () => {
    const failing = (attempts: number, err: Error) => {
      const run = vi.fn(
        async (
          _p: unknown,
          opts?: { onAttemptStart?: (n: number) => void }
        ) => {
          for (let n = 1; n <= attempts; n++) opts?.onAttemptStart?.(n);
          throw err;
        }
      );
      return {
        generateStructuredOutput: run,
        generateStructuredOutputStream: run,
      } as unknown as ClaudeStructuredOutput;
    };
    const seen: number[] = [];
    const g = gemini();
    (
      g.generateStructuredOutputStream as ReturnType<typeof vi.fn>
    ).mockImplementation(async (_p: unknown, opts?: StreamOptions) => {
      opts?.onAttemptStart?.(1);
      return 'done';
    });
    const llm = withClaudeRouting(g, failing(1, outOfCredits()), {
      fallbackModel: FALLBACK,
      vertexClaude: failing(1, outOfCredits()),
    });
    await llm.generateStructuredOutputStream(params('claude-haiku-5-5'), {
      onAttemptStart: (n) => seen.push(n),
    });
    expect(seen).toEqual([1, 2, 3]);
  });

  it('stops at an aborted call instead of walking on', async () => {
    const aborted = new AbortController();
    aborted.abort();
    const onVertex = vertex();
    const llm = withClaudeRouting(gemini(), claude(outOfCredits()), {
      fallbackModel: FALLBACK,
      vertexClaude: onVertex,
    });
    await expect(
      llm.generateStructuredOutput(
        params('claude-haiku-5-5', { abortSignal: aborted.signal })
      )
    ).rejects.toThrow('invalid_request_error');
    expect(onVertex.generateStructuredOutput).not.toHaveBeenCalled();
  });
});

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

  it("numbers the fallback attempts after Claude's and marks them as standing in for it", async () => {
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
          cacheWriteTokens: 0,
          thoughtTokens: 0,
          latencyMs: 10,
        });
        return {} as never;
      }
    );
    const starts: number[] = [];
    const completes: { attempt: number; fallbackFrom?: string }[] = [];
    const llm = withClaudeRouting(g, claudeTwice, { fallbackModel: FALLBACK });
    await llm.generateStructuredOutputStream(params('claude-haiku-5-5'), {
      onAttemptStart: (n) => starts.push(n),
      onAttemptComplete: ({ attempt, fallbackFrom }) =>
        completes.push({ attempt, fallbackFrom }),
    });

    expect(starts).toEqual([1, 2, 3]);
    expect(completes).toEqual([
      { attempt: 3, fallbackFrom: 'claude-haiku-5-5' },
    ]);
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
