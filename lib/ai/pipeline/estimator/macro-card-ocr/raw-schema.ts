/**
 * The raw wire schema emitted by Gemini Flash-Lite for single-item macro cards.
 *
 * Emits raw transcribed string tokens (value + unit), never calculated numbers.
 * The deterministic normalizer resolves units and enforces integrity.
 */

import { z } from 'zod';

const rawAmountSchema = z
  .object({
    value: z.string(),
    unit: z.string(),
  })
  .strict()
  .nullable();

const detectedRawCardSchema = z
  .object({
    cardDetected: z.literal(true),
    itemName: z.string().nullable(),
    servingSizeDescription: z.string().nullable().optional(),
    evidence: z.string().nullable(),
    calories: rawAmountSchema,
    proteinGrams: rawAmountSchema,
    carbsGrams: rawAmountSchema,
    fatGrams: rawAmountSchema,
    fiberGrams: rawAmountSchema.optional(),
    confidence: z.enum(['high', 'medium', 'low']),
  })
  .strict();

export const rawMacroCardOcrSchema = z.union([
  z.object({ cardDetected: z.literal(false) }).strict(),
  detectedRawCardSchema,
]);

export type RawMacroCardOcr = z.infer<typeof rawMacroCardOcrSchema>;
export type RawCardAmount = z.infer<typeof rawAmountSchema>;
