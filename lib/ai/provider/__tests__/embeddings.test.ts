import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('generateEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns embedding vector on success', async () => {
    const fakeEmbedding = Array.from({ length: 768 }, (_, i) => i * 0.001);
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: fakeEmbedding }],
    });

    const client = createGeminiClient({
      provider: 'ai-studio',
      apiKey: 'test-key',
    });
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

    const client = createGeminiClient({
      provider: 'ai-studio',
      apiKey: 'test-key',
    });
    await expect(client.generateEmbedding('test')).rejects.toThrow(
      'Gemini returned no embedding'
    );
  });
});

describe('generateEmbeddingBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const vec = (seed: number) => Array.from({ length: 768 }, () => seed);

  it('joins a request already in flight instead of embedding the text twice', async () => {
    let release: (v: unknown) => void = () => {};
    mockEmbedContent.mockImplementationOnce(
      () => new Promise((resolve) => (release = resolve))
    );
    const client = createGeminiClient({
      provider: 'ai-studio',
      apiKey: 'test-key',
    });

    const first = client.generateEmbeddingBatch(['in-flight phở']);
    const second = client.generateEmbeddingBatch(['in-flight phở']);
    release({ embeddings: [{ values: vec(1) }] });

    expect(await first).toEqual([vec(1)]);
    expect(await second).toEqual([vec(1)]);
    expect(mockEmbedContent).toHaveBeenCalledTimes(1);
  });

  it('requests a string repeated within one batch once', async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: vec(2) }, { values: vec(3) }],
    });
    const client = createGeminiClient({
      provider: 'ai-studio',
      apiKey: 'test-key',
    });

    const out = await client.generateEmbeddingBatch([
      'repeat cơm',
      'repeat trứng',
      'repeat cơm',
    ]);

    expect(out).toEqual([vec(2), vec(3), vec(2)]);
    expect(mockEmbedContent).toHaveBeenCalledWith(
      expect.objectContaining({ contents: ['repeat cơm', 'repeat trứng'] })
    );
  });
});
