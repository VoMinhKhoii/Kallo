/**
 * Single-item macro card OCR extraction.
 *
 * Dedicated to printed calorie/macro callouts (e.g. Soumaki, FitFood, café menus).
 * Runs Claude Haiku 5.5 primary through `createPipelineLlm`'s waterfall
 * (Anthropic API → Vertex AI Claude → Gemini 3.1 Flash-Lite at `MINIMAL`
 * thinking) for lowest cost with automatic provider failover.
 */

import { ThinkingLevel } from '@google/genai';
import {
  createBudgetAttemptRecorder,
  MACRO_CARD_OCR_BUDGET_ROUTE,
} from '@/lib/ai/pipeline/telemetry/budget';
import {
  createPipelineLlm,
  resolveGeminiProvider,
} from '@/lib/ai/provider/provider';
import type { ParsedNutritionLabel } from '@/lib/domain/nutrition/ocr/schema';
import { db } from '@/lib/infra/db/client';
import { normalizeMacroCardOcr } from './normalization';
import { MACRO_CARD_OCR_SYSTEM_PROMPT } from './prompt';
import { rawMacroCardOcrSchema } from './raw-schema';

export {
  normalizeCardAmount,
  normalizeMacroCardOcr,
} from './normalization';
export { MACRO_CARD_OCR_SYSTEM_PROMPT } from './prompt';
export { rawMacroCardOcrSchema } from './raw-schema';

export interface ScanMacroCardOptions {
  imageBase64: string;
  mimeType: string;
  model?: string;
  abortSignal?: AbortSignal;
  deadlineMs?: number;
  /** Called with the model id that actually answered (primary or fallback). */
  onModelResolved?: (model: string) => void;
}

export const MACRO_CARD_OCR_DEADLINE_MS = 20_000;
export const MACRO_CARD_OCR_MODEL = 'claude-haiku-5-5';
export const MACRO_CARD_OCR_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

function createDeadlineController(options: ScanMacroCardOptions) {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(options.abortSignal?.reason);
  if (options.abortSignal?.aborted) {
    abortFromCaller();
  } else {
    options.abortSignal?.addEventListener('abort', abortFromCaller, {
      once: true,
    });
  }
  const timeout = setTimeout(
    () =>
      controller.abort(
        new DOMException('Macro card OCR timed out', 'AbortError')
      ),
    options.deadlineMs ?? MACRO_CARD_OCR_DEADLINE_MS
  );

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeout);
      options.abortSignal?.removeEventListener('abort', abortFromCaller);
    },
  };
}

export async function scanMacroCardWithGemini(
  options: ScanMacroCardOptions
): Promise<ParsedNutritionLabel> {
  const providerConfig = resolveGeminiProvider();
  const llm = createPipelineLlm(providerConfig, {
    fallbackModel: MACRO_CARD_OCR_FALLBACK_MODEL,
  });
  const model = options.model ?? MACRO_CARD_OCR_MODEL;
  const deadline = createDeadlineController(options);
  const recordBudgetAttempt = createBudgetAttemptRecorder({
    db,
    requestId: null,
    workKind: 'primary',
    model,
    route: MACRO_CARD_OCR_BUDGET_ROUTE,
  });

  try {
    const raw = await llm.generateStructuredOutput(
      {
        schema: rawMacroCardOcrSchema,
        systemPrompt: MACRO_CARD_OCR_SYSTEM_PROMPT,
        userMessage:
          'Extract the single printed dish name and macro callouts accurately according to the JSON schema.',
        image: {
          mimeType: options.mimeType,
          base64Data: options.imageBase64,
        },
        model,
        temperature: 0.1,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        abortSignal: deadline.signal,
      },
      {
        onAttemptComplete: (metadata) => {
          recordBudgetAttempt(metadata);
          if (metadata.error == null && metadata.model) {
            options.onModelResolved?.(metadata.model);
          }
        },
      }
    );

    return normalizeMacroCardOcr(raw);
  } finally {
    deadline.dispose();
  }
}
