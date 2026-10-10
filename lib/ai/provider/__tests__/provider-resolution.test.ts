import { describe, expect, it, vi } from 'vitest';

// ── hoisted mocks (must run before module imports) ───────────────────────────
const { mockLogLlmCall } = vi.hoisted(() => ({
  mockLogLlmCall: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai/pipeline/telemetry/trace', () => ({
  logLlmCall: mockLogLlmCall,
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(),
}));

import { resolveGeminiProvider } from '../provider';

describe('resolveGeminiProvider', () => {
  it('defaults to ai-studio when AI_PROVIDER is unset', () => {
    expect(resolveGeminiProvider({ GEMINI_API_KEY: 'sk-test' })).toEqual({
      provider: 'ai-studio',
      apiKey: 'sk-test',
    });
  });

  it('returns vertex config when AI_PROVIDER=vertex with project + location', () => {
    expect(
      resolveGeminiProvider({
        AI_PROVIDER: 'vertex',
        GOOGLE_CLOUD_PROJECT: 'cal-487315',
        GOOGLE_CLOUD_LOCATION: 'asia-southeast1',
      })
    ).toEqual({
      provider: 'vertex',
      project: 'cal-487315',
      location: 'asia-southeast1',
    });
  });

  it('adds a separate embedding location only when it differs', () => {
    const base = {
      AI_PROVIDER: 'vertex',
      GOOGLE_CLOUD_PROJECT: 'cal-487315',
      GOOGLE_CLOUD_LOCATION: 'global',
    };
    expect(
      resolveGeminiProvider({
        ...base,
        GOOGLE_CLOUD_EMBEDDING_LOCATION: 'asia-southeast1',
      })
    ).toEqual({
      provider: 'vertex',
      project: 'cal-487315',
      location: 'global',
      embeddingLocation: 'asia-southeast1',
    });
    expect(
      resolveGeminiProvider({
        ...base,
        GOOGLE_CLOUD_EMBEDDING_LOCATION: 'global',
      })
    ).toEqual({
      provider: 'vertex',
      project: 'cal-487315',
      location: 'global',
    });
  });

  it('builds the embedding client on the embedding location', async () => {
    const { GoogleGenAI } = await import('@google/genai');
    const { createGeminiClient, __resetAiClientCacheForTests } = await import(
      '../provider'
    );
    __resetAiClientCacheForTests();
    vi.mocked(GoogleGenAI).mockClear();
    createGeminiClient({
      provider: 'vertex',
      project: 'cal-487315',
      location: 'global',
      embeddingLocation: 'asia-southeast1',
    });
    const locations = vi
      .mocked(GoogleGenAI)
      .mock.calls.map((c) => (c[0] as { location?: string }).location);
    expect(locations).toEqual(['global', 'asia-southeast1']);
  });

  it('throws when AI_PROVIDER=vertex but project/location is missing', () => {
    expect(() =>
      resolveGeminiProvider({
        AI_PROVIDER: 'vertex',
        GOOGLE_CLOUD_PROJECT: 'cal-487315',
      })
    ).toThrow(/GOOGLE_CLOUD_LOCATION/);

    expect(() =>
      resolveGeminiProvider({
        AI_PROVIDER: 'vertex',
      })
    ).toThrow(/GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION/);
  });

  it('throws when ai-studio is selected but GEMINI_API_KEY is missing', () => {
    expect(() => resolveGeminiProvider({})).toThrow(/GEMINI_API_KEY/);
  });

  it('throws on an unknown AI_PROVIDER value', () => {
    expect(() =>
      resolveGeminiProvider({
        AI_PROVIDER: 'openai',
        GEMINI_API_KEY: 'sk-test',
      })
    ).toThrow(/Unknown AI_PROVIDER/);
  });
});
