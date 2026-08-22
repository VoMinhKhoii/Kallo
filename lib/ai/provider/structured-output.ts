import type { GoogleGenAI } from '@google/genai';
import { buildContents, prepareRequest } from './request';
import type { RetryOptions, WithRetry } from './retry';
import type { StructuredOutputParams } from './types';

/** One non-streamed structured-output call, retries included. */
export function createStructuredOutput({
  ai,
  retry,
  withRetry,
}: {
  ai: GoogleGenAI;
  retry: RetryOptions;
  withRetry: WithRetry;
}) {
  return async function generateStructuredOutput<T>(
    params: StructuredOutputParams<T>
  ): Promise<T> {
    const { jsonSchema } = prepareRequest(params, 'structured output');

    return withRetry(
      async (attempt) => {
        const callStart = Date.now();
        const contents = buildContents(params);

        const response = await ai.models.generateContent({
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
            ...(params.thinkingConfig != null && {
              thinkingConfig: params.thinkingConfig,
            }),
            ...(params.abortSignal != null && {
              abortSignal: params.abortSignal,
            }),
          },
        });

        // Non-streaming has no TTFT split — total is the whole call.
        console.info(
          `[gemini] ${params.model} attempt ${attempt}/${retry.maxRetries}: total=${Date.now() - callStart}ms`
        );

        const text = response.text;
        if (!text) throw new Error('Gemini returned empty response');

        return params.schema.parse(JSON.parse(text));
      },
      { label: params.model, abortSignal: params.abortSignal }
    );
  };
}
