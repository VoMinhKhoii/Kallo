import { GoogleGenAI } from '@google/genai';

export type GeminiProviderConfig =
  | { provider: 'ai-studio'; apiKey: string }
  | { provider: 'vertex'; project: string; location: string }
  | { provider: 'litellm'; baseUrl: string; apiKey: string };

/**
 * Resolve the Gemini provider config from environment variables.
 *
 * - AI_PROVIDER unset or "ai-studio": uses GEMINI_API_KEY (Google AI Studio).
 * - AI_PROVIDER="vertex": uses GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION via
 *   Application Default Credentials. On Cloud Run, ADC comes from the service
 *   account; locally it comes from `gcloud auth application-default login`.
 * - AI_PROVIDER="litellm": uses LITELLM_BASE_URL + LITELLM_MASTER_KEY for local/sidecar
 *   proxy gateway routing & key rotation.
 *
 * Throws with a clear message if the required variables for the chosen
 * provider are missing or if AI_PROVIDER has an unknown value.
 */
export function resolveGeminiProvider(
  env: Record<string, string | undefined> = process.env
): GeminiProviderConfig {
  const raw = env.AI_PROVIDER?.trim();
  const provider = raw && raw.length > 0 ? raw : 'ai-studio';

  if (provider === 'vertex') {
    const project = env.GOOGLE_CLOUD_PROJECT?.trim();
    const location = env.GOOGLE_CLOUD_LOCATION?.trim();
    if (!project || !location) {
      throw new Error(
        'AI_PROVIDER=vertex requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION'
      );
    }
    return { provider: 'vertex', project, location };
  }

  if (provider === 'ai-studio') {
    const apiKey = env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('AI_PROVIDER=ai-studio requires GEMINI_API_KEY');
    }
    return { provider: 'ai-studio', apiKey };
  }

  if (provider === 'litellm') {
    const rawBaseUrl = env.LITELLM_BASE_URL?.trim() || 'http://localhost:4000';
    const baseUrl = rawBaseUrl.endsWith('/gemini')
      ? rawBaseUrl
      : `${rawBaseUrl.replace(/\/$/, '')}/gemini`;
    const apiKey =
      env.LITELLM_MASTER_KEY?.trim() || 'sk-kallo-litellm-local-dev-key';
    return { provider: 'litellm', baseUrl, apiKey };
  }

  throw new Error(
    `Unknown AI_PROVIDER="${provider}"; expected "ai-studio", "vertex", or "litellm"`
  );
}

/**
 * Module-level cache of GoogleGenAI clients keyed by provider identity.
 */
const aiClientCache = new Map<string, GoogleGenAI>();

function cacheKeyFor(config: GeminiProviderConfig): string {
  if (config.provider === 'vertex') {
    return `vertex|${config.project}|${config.location}`;
  }
  if (config.provider === 'litellm') {
    return `litellm|${config.baseUrl}|${config.apiKey}`;
  }
  return `ai-studio|${config.apiKey}`;
}

export function getOrCreateAiClient(config: GeminiProviderConfig): GoogleGenAI {
  const key = cacheKeyFor(config);
  let ai = aiClientCache.get(key);
  if (!ai) {
    if (config.provider === 'vertex') {
      ai = new GoogleGenAI({
        vertexai: true,
        project: config.project,
        location: config.location,
      });
    } else if (config.provider === 'litellm') {
      ai = new GoogleGenAI({
        apiKey: config.apiKey,
        httpOptions: { baseUrl: config.baseUrl },
      });
    } else {
      ai = new GoogleGenAI({ apiKey: config.apiKey });
    }
    aiClientCache.set(key, ai);
    const summary =
      config.provider === 'vertex'
        ? `vertex project=${config.project} location=${config.location}`
        : config.provider === 'litellm'
          ? `litellm baseUrl=${config.baseUrl}`
          : 'ai-studio';
    console.info(`[gemini] provider resolved: ${summary}`);
  }
  return ai;
}

/** Visible for testing: reset the module-level client cache. */
export function __resetAiClientCacheForTests() {
  aiClientCache.clear();
}
