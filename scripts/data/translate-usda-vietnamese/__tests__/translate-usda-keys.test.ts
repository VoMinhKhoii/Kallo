import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allKeysDailyExhausted, loadGeminiKeys, pickKey } from '../keys';

const constructorArgs: unknown[] = [];

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor(options: unknown) {
      constructorArgs.push(options);
    }
  },
}));

function clearProviderEnv() {
  vi.stubEnv('AI_PROVIDER', undefined as unknown as string);
  vi.stubEnv('GOOGLE_CLOUD_PROJECT', undefined as unknown as string);
  vi.stubEnv('GOOGLE_CLOUD_LOCATION', undefined as unknown as string);
  vi.stubEnv('GEMINI_API_KEY', undefined as unknown as string);
  for (let i = 1; i <= 20; i++) {
    vi.stubEnv(`GEMINI_API_KEY_${i}`, undefined as unknown as string);
  }
}

beforeEach(() => {
  constructorArgs.length = 0;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  clearProviderEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('loadGeminiKeys provider selection', () => {
  it('builds one ADC-backed Vertex slot when AI_PROVIDER=vertex', () => {
    vi.stubEnv('AI_PROVIDER', 'vertex');
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'kallo-prod');
    vi.stubEnv('GOOGLE_CLOUD_LOCATION', 'global');

    const slots = loadGeminiKeys();

    expect(slots).toHaveLength(1);
    expect(slots[0].apiKey).toBeNull();
    expect(constructorArgs).toEqual([
      { vertexai: true, project: 'kallo-prod', location: 'global' },
    ]);
  });

  it('ignores API keys entirely on the Vertex path', () => {
    vi.stubEnv('AI_PROVIDER', 'vertex');
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'kallo-prod');
    vi.stubEnv('GOOGLE_CLOUD_LOCATION', 'global');
    vi.stubEnv('GEMINI_API_KEY_1', 'k1');
    vi.stubEnv('GEMINI_API_KEY_2', 'k2');

    expect(loadGeminiKeys()).toHaveLength(1);
  });

  it('fails loudly when the Vertex env vars are missing', () => {
    vi.stubEnv('AI_PROVIDER', 'vertex');
    vi.stubEnv('GEMINI_API_KEY', 'k1');

    expect(() => loadGeminiKeys()).toThrow(
      'AI_PROVIDER=vertex requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION'
    );
  });

  it('keeps the multi-key AI Studio path when AI_PROVIDER is unset', () => {
    vi.stubEnv('GEMINI_API_KEY_1', 'k1');
    vi.stubEnv('GEMINI_API_KEY_3', 'k3');

    const slots = loadGeminiKeys();

    expect(slots.map((s) => s.apiKey)).toEqual(['k1', 'k3']);
    expect(constructorArgs).toEqual([{ apiKey: 'k1' }, { apiKey: 'k3' }]);
  });
});

describe('daily limit is a free-tier artifact, not a Gemini-wide law', () => {
  it('never strands a Vertex slot on the 1000-request AI Studio cap', () => {
    vi.stubEnv('AI_PROVIDER', 'vertex');
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'kallo-prod');
    vi.stubEnv('GOOGLE_CLOUD_LOCATION', 'global');

    const slots = loadGeminiKeys();
    slots[0].dailyRequests = 50_000;

    expect(pickKey(slots, 0)).toBe(slots[0]);
    expect(allKeysDailyExhausted(slots)).toBe(false);
  });

  it('still exhausts an AI Studio key at 1000 requests', () => {
    vi.stubEnv('GEMINI_API_KEY', 'k1');

    const slots = loadGeminiKeys();
    slots[0].dailyRequests = 1000;

    expect(pickKey(slots, 0)).toBeNull();
    expect(allKeysDailyExhausted(slots)).toBe(true);
  });

  it('still honours 429 cooldowns on the Vertex slot', () => {
    vi.stubEnv('AI_PROVIDER', 'vertex');
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'kallo-prod');
    vi.stubEnv('GOOGLE_CLOUD_LOCATION', 'global');

    const slots = loadGeminiKeys();
    slots[0].cooldownUntil = Date.now() + 30_000;

    expect(pickKey(slots, 0)).toBeNull();
  });
});

describe('translate-usda workflow', () => {
  const workflow = readFileSync(
    resolve('.github/workflows/translate-usda.yml'),
    'utf8'
  );

  it('runs the pipeline on Vertex with no Gemini API key secret', () => {
    expect(workflow).toContain('AI_PROVIDER: vertex');
    expect(workflow).toContain(
      `GOOGLE_CLOUD_PROJECT: \${{ vars.GCP_PROJECT_ID }}`
    );
    expect(workflow).toContain('GOOGLE_CLOUD_LOCATION: global');
    expect(workflow).not.toContain('kallo-prod-gemini-api-key');
    // Phase 1 still uses the key-authenticated Cloud Translation REST API.
    expect(workflow).toContain('kallo-google-translate-api-key');
  });

  it('saves checkpoints even when the run is cancelled or times out', () => {
    // A combined actions/cache@v4 skips its post-step save on cancel/timeout,
    // throwing away the API spend --resume exists to protect.
    expect(workflow).not.toContain('uses: actions/cache@v4');
    expect(workflow).toContain('uses: actions/cache/restore@v4');
    expect(workflow).toContain('uses: actions/cache/save@v4');
    expect(workflow).toMatch(
      /if: always\(\)\n\s+uses: actions\/cache\/save@v4/
    );
  });
});
