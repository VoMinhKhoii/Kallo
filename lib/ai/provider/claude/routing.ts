import Anthropic from '@anthropic-ai/sdk';
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import { VERTEX_RATE_SUFFIX } from '@/lib/ai/cost/pricing';
import type { GeminiProviderConfig } from '../client';
import type {
  GeminiAttemptMetadata,
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

let cached: ClaudeStructuredOutput | null | undefined;

/**
 * One Claude client per process, or null without ANTHROPIC_API_KEY. The SDK's
 * own retries are off: a failed call moves down the waterfall instead of waiting.
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

/** Haiku on Vertex AI answers on the `global` endpoint only (regions 404). */
const VERTEX_CLAUDE_REGION = 'global';

const vertexClients = new Map<string, ClaudeStructuredOutput>();

function vertexClient(project: string): ClaudeStructuredOutput {
  let client = vertexClients.get(project);
  if (!client) {
    client = createClaudeStructuredOutput(
      new AnthropicVertex({
        projectId: project,
        region: VERTEX_CLAUDE_REGION,
        maxRetries: 0,
      }),
      { rateSuffix: VERTEX_RATE_SUFFIX }
    );
    vertexClients.set(project, client);
  }
  return client;
}

/**
 * The middle step of the waterfall. Null unless the app itself runs on Vertex:
 * AI Studio setups (dev, evals) never reach it. Signs in as the runtime's
 * Google identity, with no API key.
 *
 * The SDK starts signing in when it is constructed and only handles a failure
 * once a request runs, so a client built for a meal that never reaches this
 * step could reject unhandled. Build it on the first call that needs it.
 */
export function getVertexClaudeStructuredOutput(
  config: GeminiProviderConfig
): ClaudeStructuredOutput | null {
  if (config.provider !== 'vertex') return null;
  const { project } = config;
  return {
    generateStructuredOutput: (params, opts) =>
      vertexClient(project).generateStructuredOutput(params, opts),
    generateStructuredOutputStream: (params, opts) =>
      vertexClient(project).generateStructuredOutputStream(params, opts),
  };
}

/** Visible for testing. */
export function __resetClaudeForTests(): void {
  cached = undefined;
  vertexClients.clear();
  warnedNoKey = false;
}
