import type { GoogleGenAI } from '@google/genai';
import {
  createAttemptObserver,
  createAttemptState,
  type StreamUsageMetadata,
} from './attempt-trace';
import { buildContents, prepareRequest } from './request';
import type { RetryOptions, WithRetry } from './retry';
import type { StreamOptions, StructuredOutputParams } from './types';

/** One streamed structured-output call, retries and trace rows included. */
export function createStructuredOutputStream({
  ai,
  retry,
  withRetry,
}: {
  ai: GoogleGenAI;
  retry: RetryOptions;
  withRetry: WithRetry;
}) {
  return async function generateStructuredOutputStream<T>(
    params: StructuredOutputParams<T>,
    opts?: StreamOptions
  ): Promise<T> {
    const { onAttemptComplete, onAttemptStart, onChunk, trace } = opts ?? {};
    const { jsonSchema, promptBudget } = prepareRequest(
      params,
      'streaming output'
    );

    // Mutable across the retry loop: updated as each chunk is streamed so the
    // observer can still read partial text and token counts after a throw.
    const state = createAttemptState();
    const onAttempt = createAttemptObserver({
      model: params.model,
      maxRetries: retry.maxRetries,
      promptBudget,
      state,
      trace,
      onAttemptComplete,
    });

    return withRetry(
      async (attempt) => {
        onAttemptStart?.(attempt);
        // Reset per-attempt state.
        state.accumulated = null;
        state.usage = null;

        const streamStart = Date.now();
        let firstChunkAt: number | null = null;

        const contents = buildContents(params);

        const response = await ai.models.generateContentStream({
          model: params.model,
          contents,
          config: {
            systemInstruction: params.systemPrompt,
            responseMimeType: 'application/json',
            responseJsonSchema: jsonSchema,
            ...(params.temperature != null && {
              temperature: params.temperature,
            }),
            ...(params.topP != null && { topP: params.topP }),
            ...(params.topK != null && { topK: params.topK }),
            ...(params.abortSignal != null && {
              abortSignal: params.abortSignal,
            }),
          },
        });

        let accumulated = '';
        for await (const chunk of response) {
          if (firstChunkAt == null) {
            firstChunkAt = Date.now();
          }
          const text = chunk.text ?? '';
          accumulated += text;
          state.accumulated = accumulated; // preserve partial text on failure
          if (chunk.usageMetadata) {
            state.usage = chunk.usageMetadata as StreamUsageMetadata;
          }
          if (onChunk && text.length > 0) {
            onChunk(accumulated);
          }
        }

        // Emit one combined ttft/total line per attempt — easier to grep
        // than two separate ttft/total lines and avoids implying the stream
        // can finish without ever having produced a chunk.
        const total = Date.now() - streamStart;
        const ttft = firstChunkAt != null ? firstChunkAt - streamStart : null;
        console.info(
          `[gemini] ${params.model}-stream attempt ${attempt}/${retry.maxRetries}: ttft=${ttft ?? 'n/a'}ms total=${total}ms`
        );

        if (!accumulated)
          throw new Error('Gemini stream returned empty response');
        return params.schema.parse(JSON.parse(accumulated));
      },
      { label: `${params.model}-stream`, onAttempt }
    );
  };
}
