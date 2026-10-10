/**
 * Structured output from Claude, behind the same `GeminiClient` methods the
 * pipeline already calls (Call 1, Call 2).
 *
 * Both shapes stream, so the pipeline's progressive parsers get the text as
 * it is written. A schema slip (ZodError) is re-asked once, at once; any API
 * failure (rate limit, overload, network) is thrown on the first attempt so
 * the router can fall back to Gemini without waiting out retries.
 */
import type Anthropic from '@anthropic-ai/sdk';
import {
  createAttemptObserver,
  createAttemptState,
  type StreamUsageMetadata,
} from '../attempt-trace';
import { type CallShape, prepareRequest } from '../request';
import type {
  StreamOptions,
  StructuredOutputOptions,
  StructuredOutputParams,
} from '../types';
import {
  isEmptyFoodAnswer,
  repairPipelineOutput,
  toClaudeSchema,
  withoutEmptyStrings,
} from './schema';

/** Attempts per call: the first plus one re-ask on a schema slip. */
const MAX_ATTEMPTS = 2;
/** Chunk cadence for `onChunk`: Claude streams many tiny deltas, the parsers re-scan the whole text. */
const CHUNK_INTERVAL_MS = 150;

/**
 * The system prompt as cache blocks. Everything before the first per-user
 * block (a line that opens `<language>` or `<user_context>`) is identical for
 * every request, so it gets the cache breakpoint; the per-user and per-meal
 * rest follows uncached. The text sent is byte-identical either way.
 */
export function systemBlocks(systemPrompt: string): Anthropic.TextBlockParam[] {
  const at = systemPrompt.search(/^<(language|user_context)>/m);
  if (at <= 0) {
    return [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ];
  }
  return [
    {
      type: 'text',
      text: systemPrompt.slice(0, at),
      cache_control: { type: 'ephemeral' },
    },
    { type: 'text', text: systemPrompt.slice(at) },
  ];
}

/** Claude usage, reported in the counters the trace and budget code read. */
function toUsageMetadata(usage: Anthropic.Usage): StreamUsageMetadata {
  const cached = usage.cache_read_input_tokens ?? 0;
  return {
    promptTokenCount:
      usage.input_tokens + cached + (usage.cache_creation_input_tokens ?? 0),
    candidatesTokenCount: usage.output_tokens,
    cachedContentTokenCount: cached,
    thoughtsTokenCount: 0,
  };
}

function schemaSlip(message: string): Error {
  const err = new Error(message);
  err.name = 'ZodError';
  return err;
}

export function createClaudeStructuredOutput(anthropic: Anthropic) {
  async function run<T>(
    params: StructuredOutputParams<T>,
    opts: StreamOptions | undefined,
    shape: CallShape
  ): Promise<T> {
    const { jsonSchema, promptBudget } = prepareRequest(params, shape);
    const schema = toClaudeSchema(jsonSchema) as Record<string, unknown>;
    const state = createAttemptState();
    const onAttempt = createAttemptObserver({
      model: params.model,
      maxRetries: MAX_ATTEMPTS,
      promptBudget,
      state,
      trace: opts?.trace,
      onAttemptComplete: opts?.onAttemptComplete,
    });

    for (let attempt = 1; ; attempt++) {
      const t0 = Date.now();
      opts?.onAttemptStart?.(attempt);
      state.accumulated = null;
      state.usage = null;
      let stream: ReturnType<typeof anthropic.messages.stream> | undefined;
      try {
        stream = anthropic.messages.stream(
          {
            model: params.model,
            max_tokens: 16_000,
            thinking: { type: 'disabled' },
            system: systemBlocks(params.systemPrompt),
            messages: [{ role: 'user', content: params.userMessage }],
            output_config: {
              effort: 'medium',
              format: { type: 'json_schema', schema },
            },
          },
          { signal: params.abortSignal }
        );
        let accumulated = '';
        let lastChunkAt = 0;
        stream.on('text', (delta: string) => {
          accumulated += delta;
          state.accumulated = accumulated;
          if (opts?.onChunk && Date.now() - lastChunkAt >= CHUNK_INTERVAL_MS) {
            lastChunkAt = Date.now();
            opts.onChunk(accumulated);
          }
        });
        const message = await stream.finalMessage();
        state.usage = toUsageMetadata(message.usage);
        if (accumulated) opts?.onChunk?.(accumulated);
        console.info(
          `[claude] ${params.model} attempt ${attempt}/${MAX_ATTEMPTS}: total=${Date.now() - t0}ms out=${message.usage.output_tokens} cached=${message.usage.cache_read_input_tokens ?? 0}`
        );
        if (
          message.stop_reason === 'refusal' ||
          message.stop_reason === 'max_tokens'
        )
          throw new Error(`Claude stopped: ${message.stop_reason}`);
        if (!accumulated) throw new Error('Claude returned an empty response');

        const raw = repairPipelineOutput(JSON.parse(accumulated));
        if (isEmptyFoodAnswer(raw))
          throw schemaSlip('food answer with no meal items');
        let answer = raw;
        let parsed = params.schema.safeParse(answer);
        if (!parsed.success) {
          answer = withoutEmptyStrings(raw);
          parsed = params.schema.safeParse(answer);
        }
        if (!parsed.success) throw parsed.error;
        // Trace the answer the pipeline used, so a dry-run replay of it
        // (which skips repair and validation) matches the live run.
        state.accumulated = JSON.stringify(answer);
        onAttempt(attempt, t0, parsed.data, undefined);
        return parsed.data;
      } catch (err) {
        // A stream that failed mid-way still billed its input; keep the counters.
        const partial = stream?.currentMessage?.usage;
        if (!state.usage && partial) state.usage = toUsageMetadata(partial);
        onAttempt(attempt, t0, undefined, err);
        const slip = err instanceof Error && err.name === 'ZodError';
        if (!slip || attempt >= MAX_ATTEMPTS || params.abortSignal?.aborted)
          throw err;
        console.error(`[claude] ${params.model} re-asking after a schema slip`);
      }
    }
  }

  return {
    generateStructuredOutput<T>(
      params: StructuredOutputParams<T>,
      opts?: StructuredOutputOptions
    ): Promise<T> {
      return run(params, opts, 'structured output');
    },
    generateStructuredOutputStream<T>(
      params: StructuredOutputParams<T>,
      opts?: StreamOptions
    ): Promise<T> {
      return run(params, opts, 'streaming output');
    },
  };
}
