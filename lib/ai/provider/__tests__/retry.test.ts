import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// ── hoisted mocks (must run before module imports) ───────────────────────────
const { mockLogLlmCall } = vi.hoisted(() => ({
  mockLogLlmCall: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai/pipeline/telemetry/trace', () => ({
  logLlmCall: mockLogLlmCall,
}));

const mockGenerateContent = vi.fn();
const mockGenerateContentStream = vi.fn();
const mockEmbedContent = vi.fn();

vi.mock('@google/genai', () => ({
  // biome-ignore lint/complexity/useArrowFunction: must use function() for `new` constructor mock
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return {
      models: {
        generateContent: mockGenerateContent,
        generateContentStream: mockGenerateContentStream,
        embedContent: mockEmbedContent,
      },
    };
  }),
}));

import { createGeminiClient } from '../provider';

describe('retry logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries on 429 error up to maxRetries', async () => {
    const error429 = new Error('429 Too Many Requests: retry in 2s');
    mockGenerateContent
      .mockRejectedValueOnce(error429)
      .mockRejectedValueOnce(error429)
      .mockResolvedValueOnce({
        text: JSON.stringify({ name: 'ok', value: 1 }),
      });

    const client = createGeminiClient(
      { provider: 'ai-studio', apiKey: 'test-key' },
      {
        maxRetries: 3,
        baseDelayMs: 10,
      }
    );
    const result = await client.generateStructuredOutput({
      schema: z.object({ name: z.string(), value: z.number() }),
      systemPrompt: 'test',
      userMessage: 'test',
      model: 'gemini-3-flash-preview',
    });

    expect(result).toEqual({ name: 'ok', value: 1 });
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  it('retries on 503 unavailable errors for streaming calls', async () => {
    const error503 = Object.assign(
      new Error('503 Service Unavailable: UNAVAILABLE'),
      {
        status: 503,
      }
    );
    mockGenerateContentStream
      .mockRejectedValueOnce(error503)
      .mockResolvedValueOnce(
        (async function* () {
          yield { text: JSON.stringify({ name: 'ok', value: 1 }) };
        })()
      );

    const client = createGeminiClient(
      { provider: 'ai-studio', apiKey: 'test-key' },
      {
        maxRetries: 2,
        baseDelayMs: 10,
      }
    );
    const onAttemptStart = vi.fn();
    const result = await client.generateStructuredOutputStream(
      {
        schema: z.object({ name: z.string(), value: z.number() }),
        systemPrompt: 'test',
        userMessage: 'test',
        model: 'gemini-2.5-flash-lite',
      },
      { onAttemptStart }
    );

    expect(result).toEqual({ name: 'ok', value: 1 });
    expect(mockGenerateContentStream).toHaveBeenCalledTimes(2);
    expect(onAttemptStart).toHaveBeenNthCalledWith(1, 1);
    expect(onAttemptStart).toHaveBeenNthCalledWith(2, 2);
  });

  it('throws after exhausting retries', async () => {
    const error429 = new Error('429 Too Many Requests');
    mockGenerateContent.mockRejectedValue(error429);

    const client = createGeminiClient(
      { provider: 'ai-studio', apiKey: 'test-key' },
      {
        maxRetries: 2,
        baseDelayMs: 10,
      }
    );
    await expect(
      client.generateStructuredOutput({
        schema: z.object({ name: z.string() }),
        systemPrompt: 'test',
        userMessage: 'test',
        model: 'gemini-3-flash-preview',
      })
    ).rejects.toThrow('429');
  });

  it('aborts a pending retry sleep instead of starting another attempt', async () => {
    mockGenerateContent.mockRejectedValue(
      new Error('429 Too Many Requests: retry in 30s')
    );
    const controller = new AbortController();
    const client = createGeminiClient(
      { provider: 'ai-studio', apiKey: 'test-key' },
      { maxRetries: 3, baseDelayMs: 10 }
    );

    const call = client.generateStructuredOutput({
      schema: z.object({ name: z.string() }),
      systemPrompt: 'test',
      userMessage: 'test',
      model: 'gemini-3-flash-preview',
      abortSignal: controller.signal,
    });
    const rejection = expect(call).rejects.toMatchObject({
      name: 'AbortError',
    });
    await vi.waitFor(() => expect(mockGenerateContent).toHaveBeenCalledOnce());
    controller.abort();

    await rejection;
    expect(mockGenerateContent).toHaveBeenCalledOnce();
  });

  it('RETRIES a schema-validation (ZodError) failure — the model is nondeterministic', async () => {
    // Load-bearing for the required macro triples: one malformed emission
    // must trigger a re-ask, not fail the whole call on attempt 1. The
    // first response violates the schema; the second conforms.
    mockGenerateContent
      .mockResolvedValueOnce({
        text: JSON.stringify({ name: 'test' }), // `value` missing → ZodError
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ name: 'test', value: 42 }),
      });

    // ...and it re-asks IMMEDIATELY. Backoff exists to relieve provider
    // pressure; a malformed-but-200 response applied none, so sleeping only
    // burns the shared chunk wall-clock budget. The retry sleep is the ONLY
    // timer in this path, so spying on it asserts the delay exactly (0)
    // rather than "some wall-clock threshold nobody crossed today";
    // baseDelayMs is huge so a regression to exponential backoff is loud.
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const client = createGeminiClient(
      { provider: 'ai-studio', apiKey: 'test-key' },
      {
        maxRetries: 3,
        baseDelayMs: 10_000,
      }
    );
    const result = await client.generateStructuredOutput({
      schema: z.object({ name: z.string(), value: z.number() }),
      systemPrompt: 'test',
      userMessage: 'test',
      model: 'gemini-3-flash-preview',
    });
    expect(result).toEqual({ name: 'test', value: 42 });
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy.mock.calls.map(([, ms]) => ms)).toEqual([0]);
    setTimeoutSpy.mockRestore();
  });

  it('does not retry on non-retryable 4xx errors', async () => {
    mockGenerateContent.mockRejectedValueOnce(
      Object.assign(new Error('400 Bad Request'), { status: 400 })
    );

    const client = createGeminiClient(
      { provider: 'ai-studio', apiKey: 'test-key' },
      {
        maxRetries: 3,
        baseDelayMs: 10,
      }
    );
    await expect(
      client.generateStructuredOutput({
        schema: z.object({ name: z.string() }),
        systemPrompt: 'test',
        userMessage: 'test',
        model: 'gemini-3-flash-preview',
      })
    ).rejects.toThrow('400');

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });
});
