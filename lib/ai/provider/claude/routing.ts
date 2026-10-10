import Anthropic from '@anthropic-ai/sdk';
import type {
  GeminiClient,
  StreamOptions,
  StructuredOutputOptions,
  StructuredOutputParams,
} from '../types';
import { createClaudeStructuredOutput } from './structured-output';

export type ClaudeStructuredOutput = ReturnType<
  typeof createClaudeStructuredOutput
>;

export const isClaudeModel = (model: string): boolean =>
  model.startsWith('claude-');

/**
 * Wrap a Gemini client so a call whose model is a Claude model (`claude-*`)
 * goes to Claude; every other call, and every embedding, stays on Gemini.
 *
 * Any Claude failure — no API key, rate limit, overload, network, a schema
 * slip that survived its re-ask — re-runs that one call on Gemini with
 * `fallbackModel`, so a Claude outage degrades to today's pipeline instead of
 * failing meals. A call the caller aborted (a stage deadline) is not re-run.
 */
export function withClaudeRouting(
  gemini: GeminiClient,
  claude: ClaudeStructuredOutput | null,
  options: { fallbackModel: string }
): GeminiClient {
  function route<O>(
    viaClaude: (
      c: ClaudeStructuredOutput
    ) => <T>(params: StructuredOutputParams<T>, opts?: O) => Promise<T>,
    viaGemini: <T>(params: StructuredOutputParams<T>, opts?: O) => Promise<T>
  ) {
    return async <T>(
      params: StructuredOutputParams<T>,
      opts?: O
    ): Promise<T> => {
      if (!isClaudeModel(params.model)) return viaGemini(params, opts);
      const fallback = { ...params, model: options.fallbackModel };
      if (!claude) {
        warnNoKeyOnce();
        return viaGemini(fallback, opts);
      }
      if (params.image) return viaGemini(fallback, opts);
      try {
        return await viaClaude(claude)(params, opts);
      } catch (err) {
        if (params.abortSignal?.aborted) throw err;
        console.warn(
          `[llm] ${params.model} failed (${describe(err)}); re-running on ${options.fallbackModel}`
        );
        return viaGemini(fallback, opts);
      }
    };
  }

  return {
    ...gemini,
    generateStructuredOutput: route<StructuredOutputOptions>(
      (c) => c.generateStructuredOutput,
      gemini.generateStructuredOutput
    ),
    generateStructuredOutputStream: route<StreamOptions>(
      (c) => c.generateStructuredOutputStream,
      gemini.generateStructuredOutputStream
    ),
  };
}

function describe(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const status = (err as { status?: unknown }).status;
  return typeof status === 'number' ? `${status} ${err.name}` : err.name;
}

let warnedNoKey = false;
function warnNoKeyOnce(): void {
  if (warnedNoKey) return;
  warnedNoKey = true;
  console.warn(
    '[llm] ANTHROPIC_API_KEY is not set; Claude models run on Gemini'
  );
}

let cached: ClaudeStructuredOutput | null | undefined;

/**
 * One Claude client per process, or null without ANTHROPIC_API_KEY. The SDK's
 * own retries are off: a failed call falls back to Gemini instead of waiting.
 */
export function getClaudeStructuredOutput(): ClaudeStructuredOutput | null {
  if (cached === undefined) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    cached = apiKey
      ? createClaudeStructuredOutput(new Anthropic({ apiKey, maxRetries: 0 }))
      : null;
  }
  return cached;
}

/** Visible for testing. */
export function __resetClaudeForTests(): void {
  cached = undefined;
  warnedNoKey = false;
}
