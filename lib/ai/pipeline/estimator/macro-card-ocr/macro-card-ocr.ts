/**
 * Single-item macro card OCR extraction using Gemini 3.1 Flash-Lite.
 *
 * Dedicated to printed calorie/macro callouts (e.g. Soumaki, FitFood, café menus).
 * Uses a concise 4-macro wire schema with thinkingLevel='low' to minimize token costs.
 */

import { ThinkingLevel } from '@google/genai';
import {
  createBudgetAttemptRecorder,
  MACRO_CARD_OCR_BUDGET_ROUTE,
} from '@/lib/ai/pipeline/telemetry/budget';
import {
  createGeminiClient,
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
}

export const MACRO_CARD_OCR_DEADLINE_MS = 20_000;
export const MACRO_CARD_OCR_MODEL = 'gemini-3.1-flash-lite';

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
  const gemini = createGeminiClient(providerConfig);
  const model = options.model ?? MACRO_CARD_OCR_MODEL;
  const deadline = createDeadlineController(options);

  try {
    const raw = await gemini.generateStructuredOutput(
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
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        abortSignal: deadline.signal,
      },
      {
        onAttemptComplete: createBudgetAttemptRecorder({
          db,
          requestId: null,
          workKind: 'primary',
          model,
          route: MACRO_CARD_OCR_BUDGET_ROUTE,
        }),
      }
    );

    return normalizeMacroCardOcr(raw);
  } finally {
    deadline.dispose();
  }
}
