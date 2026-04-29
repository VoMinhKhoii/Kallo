import type { ThinkingLevel } from '@google/genai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// ── hoisted mocks (must run before module imports) ───────────────────────────
const { mockLogLlmCall } = vi.hoisted(() => ({
  mockLogLlmCall: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai/pipeline/trace', () => ({
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

import type { AppDb } from '@/lib/db';
import { createGeminiClient } from '../gemini';

describe('GeminiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateStructuredOutput', () => {
    const testSchema = z.object({
      name: z.string(),
      value: z.number(),
    });

    it('returns parsed response on success', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({ name: 'test', value: 42 }),
      });

      const client = createGeminiClient('test-key');
      const result = await client.generateStructuredOutput({
        schema: testSchema,
        systemPrompt: 'You are a test assistant.',
        userMessage: 'Give me data.',
        model: 'gemini-3-flash-preview',
      });

      expect(result).toEqual({ name: 'test', value: 42 });
      expect(mockGenerateContent).toHaveBeenCalledOnce();
    });

    it('throws on null response text', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: null });

      const client = createGeminiClient('test-key');
      await expect(
        client.generateStructuredOutput({
          schema: testSchema,
          systemPrompt: 'test',
          userMessage: 'test',
          model: 'gemini-3-flash-preview',
        })
      ).rejects.toThrow('Gemini returned empty response');
    });

    it('throws on invalid JSON that does not match schema', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({ name: 'test', value: 'not-a-number' }),
      });

      const client = createGeminiClient('test-key');
      await expect(
        client.generateStructuredOutput({
          schema: testSchema,
          systemPrompt: 'test',
          userMessage: 'test',
          model: 'gemini-3-flash-preview',
        })
      ).rejects.toThrow();
    });

    it('forwards thinkingConfig to the API call', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({ name: 'test', value: 1 }),
      });

      const client = createGeminiClient('test-key');
      await client.generateStructuredOutput({
        schema: testSchema,
        systemPrompt: 'test',
        userMessage: 'test',
        model: 'gemini-3-flash-preview',
        thinkingConfig: { thinkingLevel: 'low' as ThinkingLevel },
      });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            thinkingConfig: { thinkingLevel: 'low' as ThinkingLevel },
          }),
        })
      );
    });

    it('forwards abortSignal to the API call', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({ name: 'test', value: 1 }),
      });

      const client = createGeminiClient('test-key');
      const controller = new AbortController();

      await client.generateStructuredOutput({
        schema: testSchema,
        systemPrompt: 'test',
        userMessage: 'test',
        model: 'gemini-3-flash-preview',
        abortSignal: controller.signal,
      });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            abortSignal: controller.signal,
          }),
        })
      );
    });
  });

  describe('generateStructuredOutputStream', () => {
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

      const client = createGeminiClient('test-key');
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
  });

  describe('generateEmbedding', () => {
    it('returns embedding vector on success', async () => {
      const fakeEmbedding = Array.from({ length: 768 }, (_, i) => i * 0.001);
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: fakeEmbedding }],
      });

      const client = createGeminiClient('test-key');
      const result = await client.generateEmbedding('thịt bò');

      expect(result).toEqual(fakeEmbedding);
      expect(result).toHaveLength(768);
      expect(mockEmbedContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-embedding-001',
          config: { outputDimensionality: 768 },
        })
      );
    });

    it('throws when embedding is missing', async () => {
      mockEmbedContent.mockResolvedValueOnce({ embeddings: [] });

      const client = createGeminiClient('test-key');
      await expect(client.generateEmbedding('test')).rejects.toThrow(
        'Gemini returned no embedding'
      );
    });
  });

  describe('retry logic', () => {
    it('retries on 429 error up to maxRetries', async () => {
      const error429 = new Error('429 Too Many Requests: retry in 2s');
      mockGenerateContent
        .mockRejectedValueOnce(error429)
        .mockRejectedValueOnce(error429)
        .mockResolvedValueOnce({
          text: JSON.stringify({ name: 'ok', value: 1 }),
        });

      const client = createGeminiClient('test-key', {
        maxRetries: 3,
        baseDelayMs: 10,
      });
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

      const client = createGeminiClient('test-key', {
        maxRetries: 2,
        baseDelayMs: 10,
      });
      const result = await client.generateStructuredOutputStream({
        schema: z.object({ name: z.string(), value: z.number() }),
        systemPrompt: 'test',
        userMessage: 'test',
        model: 'gemini-2.5-flash-lite',
      });

      expect(result).toEqual({ name: 'ok', value: 1 });
      expect(mockGenerateContentStream).toHaveBeenCalledTimes(2);
    });

    it('throws after exhausting retries', async () => {
      const error429 = new Error('429 Too Many Requests');
      mockGenerateContent.mockRejectedValue(error429);

      const client = createGeminiClient('test-key', {
        maxRetries: 2,
        baseDelayMs: 10,
      });
      await expect(
        client.generateStructuredOutput({
          schema: z.object({ name: z.string() }),
          systemPrompt: 'test',
          userMessage: 'test',
          model: 'gemini-3-flash-preview',
        })
      ).rejects.toThrow('429');
    });

    it('does not retry on non-retryable 4xx errors', async () => {
      mockGenerateContent.mockRejectedValueOnce(
        Object.assign(new Error('400 Bad Request'), { status: 400 })
      );

      const client = createGeminiClient('test-key', {
        maxRetries: 3,
        baseDelayMs: 10,
      });
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

  // ── trace logging tests ──────────────────────────────────────────────────

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
      const client = createGeminiClient('test-key', {
        maxRetries: 2,
        baseDelayMs: 10,
      });

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
      const client = createGeminiClient('test-key', {
        maxRetries: 3,
        baseDelayMs: 10,
      });

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

      const client = createGeminiClient('test-key', {
        maxRetries: 2,
        baseDelayMs: 10,
      });

      await client.generateStructuredOutputStream({
        schema: traceSchema,
        systemPrompt: 'sys',
        userMessage: 'user',
        model: 'gemini-test',
      });

      expect(mockLogLlmCall).not.toHaveBeenCalled();
    });
  });
});
