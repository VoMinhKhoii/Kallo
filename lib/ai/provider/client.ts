import { GoogleGenAI } from '@google/genai';

export type GeminiProviderConfig =
  | { provider: 'ai-studio'; apiKey: string }
  | {
      provider: 'vertex';
      project: string;
      location: string;
      /**
       * Vertex location for embeddings when it differs from `location`.
       * `gemini-3.1-flash-lite` exists only on `global`, but
       * `gemini-embedding-001` is regional too, and the endpoint next to Cloud
       * Run answers in ~0.3-0.5 s vs ~0.6-1.7 s on `global` with identical
       * vectors (cosine 1.0), so stored embeddings stay valid.
       */
      embeddingLocation?: string;
    };

/**
 * Resolve the Gemini provider config from environment variables.
 *
 * - AI_PROVIDER unset or "ai-studio": uses GEMINI_API_KEY (Google AI Studio).
 * - AI_PROVIDER="vertex": uses GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION via
 *   Application Default Credentials. On Cloud Run, ADC comes from the service
 *   account; locally it comes from `gcloud auth application-default login`.
 *   Optional GOOGLE_CLOUD_EMBEDDING_LOCATION sends embeddings to that location.
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
    const embeddingLocation = env.GOOGLE_CLOUD_EMBEDDING_LOCATION?.trim();
    return {
      provider: 'vertex',
      project,
      location,
      ...(embeddingLocation && embeddingLocation !== location
        ? { embeddingLocation }
        : {}),
    };
  }

  if (provider === 'ai-studio') {
    const apiKey = env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('AI_PROVIDER=ai-studio requires GEMINI_API_KEY');
    }
    return { provider: 'ai-studio', apiKey };
  }

  throw new Error(
    `Unknown AI_PROVIDER="${provider}"; expected "ai-studio" or "vertex"`
  );
}

/**
 * Module-level cache of GoogleGenAI clients keyed by provider identity.
 *
 * Why: on the Vertex path the SDK constructs a GoogleAuth instance whose
 * cachedCredential lives only for the lifetime of that GoogleGenAI. A fresh
 * client per request means a fresh metadata-server token fetch per request
 * (~10-40 ms warm, ~50-150 ms cold) on the critical path of every meal
 * analysis. Reusing a single client per {provider,project,location|apiKey}
 * lets the SDK amortize OAuth token refresh across requests (~1 fetch/hour).
 *
 * Cache-miss logs double as a startup signal for which provider resolved —
 * silent fallback to ai-studio (e.g. an empty AI_PROVIDER env var on a
 * Vertex-bound Cloud Run service) is visible in Cloud Logging on first use.
 */
const aiClientCache = new Map<string, GoogleGenAI>();

function cacheKeyFor(config: GeminiProviderConfig): string {
  return config.provider === 'vertex'
    ? `vertex|${config.project}|${config.location}`
    : `ai-studio|${config.apiKey}`;
}

export function getOrCreateAiClient(config: GeminiProviderConfig): GoogleGenAI {
  const key = cacheKeyFor(config);
  let ai = aiClientCache.get(key);
  if (!ai) {
    ai =
      config.provider === 'vertex'
        ? new GoogleGenAI({
            vertexai: true,
            project: config.project,
            location: config.location,
          })
        : new GoogleGenAI({ apiKey: config.apiKey });
    aiClientCache.set(key, ai);
    const summary =
      config.provider === 'vertex'
        ? `vertex project=${config.project} location=${config.location}`
        : 'ai-studio';
    console.info(`[gemini] provider resolved: ${summary}`);
  }
  return ai;
}

/** Visible for testing: reset the module-level client cache. */
export function __resetAiClientCacheForTests() {
  aiClientCache.clear();
}
