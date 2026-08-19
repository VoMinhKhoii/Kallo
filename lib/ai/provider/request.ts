import {
  measurePromptBudget,
  type PromptBudget,
} from '@/lib/ai/prompts/budget';
import {
  getProviderJsonSchemaMode,
  type ProviderJsonSchema,
  toProviderJsonSchema,
} from '@/lib/ai/prompts/schema';
import type { StructuredOutputParams } from './types';

/**
 * Shared request shaping for both call shapes (structured, streaming).
 *
 * Kept in one place because the two shapes must send the provider *the same*
 * schema and measure the same budget — a divergence here is invisible until a
 * streamed call silently ships a different schema than its non-streamed twin.
 */

/** Gemini rejects inline image parts above this size; fail before the call. */
const MAX_INLINE_BYTES = 10 * 1024 * 1024;

/** The phrase that names the call shape in the prompt-budget log line. */
export type CallShape = 'structured output' | 'streaming output';

/**
 * Convert the Zod schema to the provider dialect and log the prompt budget.
 * Runs once per call, outside the retry loop.
 */
export function prepareRequest<T>(
  params: StructuredOutputParams<T>,
  shape: CallShape
): { jsonSchema: ProviderJsonSchema; promptBudget: PromptBudget } {
  const jsonSchema = toProviderJsonSchema(params.schema, {
    mode: getProviderJsonSchemaMode(),
  });
  const promptBudget = measurePromptBudget({
    systemPrompt: params.systemPrompt,
    userMessage: params.userMessage,
    schema: jsonSchema,
  });
  console.info(
    `[gemini] ${params.model} ${shape}: prompt=${promptBudget.systemChars + promptBudget.userChars} chars (~${promptBudget.approxTokens} tokens incl schema), schema=${promptBudget.schemaChars} chars`
  );
  return { jsonSchema, promptBudget };
}

/**
 * Build the `contents` payload for one attempt, rejecting oversized inline
 * images first. Called inside the retry loop, exactly as before the split, so
 * the size check still counts as attempt failure rather than call setup.
 */
export function buildContents<T>(params: StructuredOutputParams<T>) {
  if (params.image) {
    const approxBytes = Math.ceil((params.image.base64Data.length * 3) / 4);
    if (approxBytes > MAX_INLINE_BYTES) {
      throw new Error(
        `Image payload exceeds inline limit (${(approxBytes / (1024 * 1024)).toFixed(1)}MB > 10MB)`
      );
    }
  }

  return params.image
    ? [
        {
          inlineData: {
            mimeType: params.image.mimeType,
            data: params.image.base64Data,
          },
        },
        params.userMessage,
      ]
    : params.userMessage;
}
