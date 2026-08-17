import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toJSONSchema, z } from 'zod';

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

import type { AppDb } from '@/lib/infra/db';
import { createGeminiClient } from '../provider';

describe('generateStructuredOutputStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const testSchema = z.object({
    name: z.string(),
    value: z.number(),
  });

  it('forwards abortSignal to the streaming API call', async () => {
    mockGenerateContentStream.mockResolvedValueOnce(
      (async function* () {
        yield { text: JSON.stringify({ name: 'test', value: 1 }) };
      })()
    );

    const client = createGeminiClient({
      provider: 'ai-studio',
      apiKey: 'test-key',
    });
    const controller = new AbortController();

    const result = await client.generateStructuredOutputStream({
      schema: testSchema,
      systemPrompt: 'test',
      userMessage: 'test',
      model: 'gemini-3-flash-preview',
      abortSignal: controller.signal,
    });

    expect(result).toEqual({ name: 'test', value: 1 });
    expect(mockGenerateContentStream).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          abortSignal: controller.signal,
        }),
      })
    );
  });

  it('applies slim provider JSON schema to streaming calls', async () => {
    vi.stubEnv('PIPELINE_PROVIDER_SCHEMA_MODE', 'slim');
    const describedSchema = z.object({
      name: z.string().describe('Name to stream'),
      value: z.number(),
    });
    mockGenerateContentStream.mockResolvedValueOnce(
      (async function* () {
        yield { text: JSON.stringify({ name: 'test', value: 1 }) };
      })()
    );

    const client = createGeminiClient({
      provider: 'ai-studio',
      apiKey: 'test-key',
    });
    await client.generateStructuredOutputStream({
      schema: describedSchema,
      systemPrompt: 'test',
      userMessage: 'test',
      model: 'gemini-3-flash-preview',
    });

    expect(mockGenerateContentStream).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          responseJsonSchema: expect.objectContaining({
            properties: expect.objectContaining({
              name: expect.not.objectContaining({
                description: 'Name to stream',
              }),
            }),
          }),
        }),
      })
    );
  });
});

// ── trace logging tests ────────────────────────────────────────────────────

describe('generateStructuredOutputStream with trace', () => {
  const traceSchema = z.object({ items: z.array(z.string()) });

  function makeDb() {
    const catchFn = vi.fn();
    const values = vi.fn().mockReturnValue({ catch: catchFn });
    const insert = vi.fn().mockReturnValue({ values });
    return { db: { insert } as unknown as AppDb, insert, values, catchFn };
  }

  function makeTrace(db: AppDb) {
    return {
      db,
      requestId: 'req-1',
      stageLogId: 'stage-1',
      promptVersionId: 'pv-1',
      promptRendered: 'test prompt',
    };
  }

  function streamChunks(
    chunks: Array<{
      text?: string;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    }>
  ) {
    return (async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogLlmCall.mockClear();
  });

  it('logs 1 pipeline_llm_calls insert on first-try success with token counts', async () => {
    mockGenerateContentStream.mockResolvedValueOnce(
      streamChunks([
        { text: '{"items":["a"]}' },
        { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 } },
      ])
    );

    const { db } = makeDb();
    const client = createGeminiClient(
      { provider: 'ai-studio', apiKey: 'test-key' },
      {
        maxRetries: 2,
        baseDelayMs: 10,
      }
    );

    const result = await client.generateStructuredOutputStream(
      {
        schema: traceSchema,
        systemPrompt: 'sys',
        userMessage: 'user',
        model: 'gemini-test',
      },
      { trace: makeTrace(db) }
    );

    expect(result).toEqual({ items: ['a'] });
    expect(mockLogLlmCall).toHaveBeenCalledOnce();

    const call = mockLogLlmCall.mock.calls[0][0];
    expect(call.attempt).toBe(1);
    expect(call.inputTokens).toBe(10);
    expect(call.outputTokens).toBe(20);
    expect(call.error).toBeUndefined();
    expect(call.requestId).toBe('req-1');
    expect(call.stageLogId).toBe('stage-1');
    expect(call.promptVersionId).toBe('pv-1');
    expect(call.metadata).toEqual({
      promptChars: 'sys'.length + 'user'.length,
      schemaChars: JSON.stringify(toJSONSchema(traceSchema)).length,
    });
  });

  it('logs 2 inserts when stream throws once then succeeds (attempt 1 error, attempt 2 success)', async () => {
    const retryableError = Object.assign(new Error('503 UNAVAILABLE'), {
      status: 503,
    });
    mockGenerateContentStream
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce(
        streamChunks([
          { text: '{"items":["b"]}' },
          {
            usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 15 },
          },
        ])
      );

    const { db } = makeDb();
    const client = createGeminiClient(
      { provider: 'ai-studio', apiKey: 'test-key' },
      {
        maxRetries: 3,
        baseDelayMs: 10,
      }
    );

    const result = await client.generateStructuredOutputStream(
      {
        schema: traceSchema,
        systemPrompt: 'sys',
        userMessage: 'user',
        model: 'gemini-test',
      },
      { trace: makeTrace(db) }
    );

    expect(result).toEqual({ items: ['b'] });
    expect(mockLogLlmCall).toHaveBeenCalledTimes(2);

    const attempt1 = mockLogLlmCall.mock.calls[0][0];
    expect(attempt1.attempt).toBe(1);
    expect(attempt1.error).toBe('503 UNAVAILABLE');
    expect(attempt1.inputTokens).toBeNull();
    expect(attempt1.outputTokens).toBeNull();

    const attempt2 = mockLogLlmCall.mock.calls[1][0];
    expect(attempt2.attempt).toBe(2);
    expect(attempt2.error).toBeUndefined();
    expect(attempt2.inputTokens).toBe(5);
    expect(attempt2.outputTokens).toBe(15);
  });

  it('logs 0 inserts when no trace arg is provided', async () => {
    mockGenerateContentStream.mockResolvedValueOnce(
      streamChunks([{ text: '{"items":["c"]}' }])
    );

    const client = createGeminiClient(
      { provider: 'ai-studio', apiKey: 'test-key' },
      {
        maxRetries: 2,
        baseDelayMs: 10,
      }
    );

    await client.generateStructuredOutputStream({
      schema: traceSchema,
      systemPrompt: 'sys',
      userMessage: 'user',
      model: 'gemini-test',
    });

    expect(mockLogLlmCall).not.toHaveBeenCalled();
  });

  it('emits attempt token metadata when trace is disabled', async () => {
    mockGenerateContentStream.mockResolvedValueOnce(
      streamChunks([
        { text: '{"items":["d"]}' },
        { usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 34 } },
      ])
    );

    const client = createGeminiClient(
      { provider: 'ai-studio', apiKey: 'test-key' },
      {
        maxRetries: 2,
        baseDelayMs: 10,
      }
    );
    const onAttemptComplete = vi.fn();

    const result = await client.generateStructuredOutputStream(
      {
        schema: traceSchema,
        systemPrompt: 'sys',
        userMessage: 'user',
        model: 'gemini-test',
      },
      { onAttemptComplete }
    );

    expect(result).toEqual({ items: ['d'] });
    expect(mockLogLlmCall).not.toHaveBeenCalled();
    expect(onAttemptComplete).toHaveBeenCalledWith({
      attempt: 1,
      model: 'gemini-test',
      inputTokens: 12,
      outputTokens: 34,
      error: null,
    });
  });

  it('emits retryable attempt errors even when a later attempt succeeds', async () => {
    const retryableError = Object.assign(new Error('503 UNAVAILABLE'), {
      status: 503,
    });
    mockGenerateContentStream
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce(
        streamChunks([
          { text: '{"items":["e"]}' },
          {
            usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 11 },
          },
        ])
      );

    const client = createGeminiClient(
      { provider: 'ai-studio', apiKey: 'test-key' },
      {
        maxRetries: 2,
        baseDelayMs: 10,
      }
    );
    const onAttemptComplete = vi.fn();

    const result = await client.generateStructuredOutputStream(
      {
        schema: traceSchema,
        systemPrompt: 'sys',
        userMessage: 'user',
        model: 'gemini-test',
      },
      { onAttemptComplete }
    );

    expect(result).toEqual({ items: ['e'] });
    expect(mockLogLlmCall).not.toHaveBeenCalled();
    expect(onAttemptComplete).toHaveBeenCalledTimes(2);
    expect(onAttemptComplete).toHaveBeenNthCalledWith(1, {
      attempt: 1,
      model: 'gemini-test',
      inputTokens: null,
      outputTokens: null,
      error: retryableError,
    });
    expect(onAttemptComplete).toHaveBeenNthCalledWith(2, {
      attempt: 2,
      model: 'gemini-test',
      inputTokens: 7,
      outputTokens: 11,
      error: null,
    });
  });
});
