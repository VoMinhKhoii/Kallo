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

describe('generateStructuredOutput attempt usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const schema = z.object({ name: z.string() });

  it('reports every billable token counter, thinking and cache included', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ name: 'ok' }),
      usageMetadata: {
        promptTokenCount: 900,
        candidatesTokenCount: 40,
        cachedContentTokenCount: 600,
        thoughtsTokenCount: 250,
      },
    });
    const onAttemptComplete = vi.fn();
    const client = createGeminiClient({ provider: 'ai-studio', apiKey: 'k' });

    await client.generateStructuredOutput(
      { schema, systemPrompt: 's', userMessage: 'u', model: 'm' },
      { onAttemptComplete }
    );

    expect(onAttemptComplete).toHaveBeenCalledExactlyOnceWith({
      attempt: 1,
      model: 'm',
      inputTokens: 900,
      outputTokens: 40,
      cachedTokens: 600,
      thoughtTokens: 250,
      error: null,
    });
  });

  it('still reports the tokens of an attempt whose response failed the schema', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({
        text: JSON.stringify({ wrong: true }),
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 9 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ name: 'ok' }),
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 7 },
      });
    const onAttemptComplete = vi.fn();
    const client = createGeminiClient(
      { provider: 'ai-studio', apiKey: 'k' },
      { maxRetries: 2, baseDelayMs: 1 }
    );

    await client.generateStructuredOutput(
      { schema, systemPrompt: 's', userMessage: 'u', model: 'm' },
      { onAttemptComplete }
    );

    expect(onAttemptComplete).toHaveBeenCalledTimes(2);
    expect(onAttemptComplete.mock.calls[0][0]).toMatchObject({
      attempt: 1,
      inputTokens: 100,
      outputTokens: 9,
      error: expect.objectContaining({ name: 'ZodError' }),
    });
    expect(onAttemptComplete.mock.calls[1][0]).toMatchObject({
      attempt: 2,
      outputTokens: 7,
      error: null,
    });
  });
});
