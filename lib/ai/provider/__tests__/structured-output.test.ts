import type { ThinkingLevel } from '@google/genai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('generateStructuredOutput', () => {
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

  it('returns parsed response on success', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ name: 'test', value: 42 }),
    });

    const client = createGeminiClient({
      provider: 'ai-studio',
      apiKey: 'test-key',
    });
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

    const client = createGeminiClient({
      provider: 'ai-studio',
      apiKey: 'test-key',
    });
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

    const client = createGeminiClient({
      provider: 'ai-studio',
      apiKey: 'test-key',
    });
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

    const client = createGeminiClient({
      provider: 'ai-studio',
      apiKey: 'test-key',
    });
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

    const client = createGeminiClient({
      provider: 'ai-studio',
      apiKey: 'test-key',
    });
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

  it('uses the full provider JSON schema by default', async () => {
    const describedSchema = z.object({
      name: z.string().describe('Name to return'),
    });
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ name: 'test' }),
    });

    const client = createGeminiClient({
      provider: 'ai-studio',
      apiKey: 'test-key',
    });
    await client.generateStructuredOutput({
      schema: describedSchema,
      systemPrompt: 'test',
      userMessage: 'test',
      model: 'gemini-3-flash-preview',
    });

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          responseJsonSchema: expect.objectContaining({
            properties: expect.objectContaining({
              name: expect.objectContaining({
                description: 'Name to return',
              }),
            }),
          }),
        }),
      })
    );
  });

  it('uses slim provider JSON schema only when explicitly enabled', async () => {
    vi.stubEnv('PIPELINE_PROVIDER_SCHEMA_MODE', 'slim');
    const describedSchema = z.object({
      name: z.string().describe('Name to return'),
    });
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ name: 'test' }),
    });

    const client = createGeminiClient({
      provider: 'ai-studio',
      apiKey: 'test-key',
    });
    await client.generateStructuredOutput({
      schema: describedSchema,
      systemPrompt: 'test',
      userMessage: 'test',
      model: 'gemini-3-flash-preview',
    });

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          responseJsonSchema: expect.objectContaining({
            properties: expect.objectContaining({
              name: expect.not.objectContaining({
                description: 'Name to return',
              }),
            }),
          }),
        }),
      })
    );
  });
});
