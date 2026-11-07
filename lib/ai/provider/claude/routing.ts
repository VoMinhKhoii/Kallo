import Anthropic from '@anthropic-ai/sdk';
import type {
  GeminiAttemptMetadata,
  GeminiClient,
  StreamOptions,
  StructuredOutputOptions,
  StructuredOutputParams,
} from '../types';
import type { createClaudeStructuredOutput } from './structured-output';

export type ClaudeStructuredOutput = ReturnType<
  typeof createClaudeStructuredOutput
>;

export const isClaudeModel = (model: string): boolean =>
  model.startsWith('claude-');

/**
 * Wrap a Gemini client so a call whose model is a Claude model (`claude-*`)
 * goes to Claude; every other call, and every embedding, stays on Gemini.
 *
 * A failed call walks a waterfall, each step for that one call: the Claude
 * API, then Claude on Vertex AI (`vertexClaude`), then Gemini on
 * `fallbackModel`. An API failure on the Claude API (no credits, rate limit,
 * overload, network) moves to Vertex, which bills elsewhere. A bad answer (a
 * schema slip that survived its re-ask, a refusal) skips Vertex: the same
 * model would likely repeat it, so Gemini re-runs it instead. So a Claude
 * outage degrades instead of failing meals. A call the caller aborted (a stage
 * deadline) is not re-run.
 *
 * Each re-run continues the attempt numbering: callers reset their stream
 * parsers on any attempt after the first, so one step's partial output never
 * mixes with the next's.
 */
export function withClaudeRouting(
  gemini: GeminiClient,
  claude: ClaudeStructuredOutput | null,
  options: {
    fallbackModel: string;
    vertexClaude?: ClaudeStructuredOutput | null;
  }
): GeminiClient {
  const steps = [claude, options.vertexClaude ?? null].filter(
    (step): step is ClaudeStructuredOutput => step !== null
  );

  function route<O extends AttemptHooks>(
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
      if (steps.length === 0) {
        warnNoKeyOnce();
        return viaGemini(fallback, opts);
      }
      if (params.image) return viaGemini(fallback, opts);
      let attempts = 0;
      for (const step of steps) {
        const counted = countAttempts(
          attempts ? fallbackHooks(opts, attempts, params.model) : opts
        );
        try {
          return await viaClaude(step)(params, counted.opts);
        } catch (err) {
          if (params.abortSignal?.aborted) throw err;
          attempts += counted.attempts();
          console.warn(`[llm] ${params.model} failed (${describe(err)})`);
          if (!(err instanceof Anthropic.APIError)) break;
        }
      }
      console.warn(`[llm] re-running on ${options.fallbackModel}`);
      return viaGemini(fallback, fallbackHooks(opts, attempts, params.model));
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

type AttemptHooks = Pick<StreamOptions, 'onAttemptStart' | 'onAttemptComplete'>;

/** Wrap the hooks to record the highest attempt number they see. */
function countAttempts<O extends AttemptHooks>(opts: O | undefined) {
  let attempts = 0;
  const seen = (n: number) => {
    attempts = Math.max(attempts, n);
  };
  return {
    attempts: () => attempts,
    opts: opts && {
      ...opts,
      onAttemptStart: (n: number) => {
        seen(n);
        opts.onAttemptStart?.(n);
      },
      onAttemptComplete: (m: GeminiAttemptMetadata) => {
        seen(m.attempt);
        opts.onAttemptComplete?.(m);
      },
    },
  };
}

/**
 * Hooks for the re-run of a failed Claude call: attempts are numbered from
 * `offset + 1`, and each one reports the Claude model it stands in for.
 */
function fallbackHooks<O extends AttemptHooks>(
  opts: O | undefined,
  offset: number,
  fallbackFrom: string
): O | undefined {
  if (!opts) return opts;
  return {
    ...opts,
    onAttemptStart: opts.onAttemptStart
      ? (n: number) => opts.onAttemptStart?.(offset + n)
      : undefined,
    onAttemptComplete: opts.onAttemptComplete
      ? (m: GeminiAttemptMetadata) =>
          opts.onAttemptComplete?.({
            ...m,
            attempt: offset + m.attempt,
            fallbackFrom,
          })
      : undefined,
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
