import type { ThinkingLevel } from '@google/genai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

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
});
