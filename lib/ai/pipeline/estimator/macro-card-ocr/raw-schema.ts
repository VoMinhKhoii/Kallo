/**
 * The raw wire schema emitted by the vision model for single-item macro cards.
 *
 * Uses a single flat root object (no top-level `anyOf`) so both Claude
 * structured outputs and Gemini accept the exact same JSON Schema. Emits raw
 * transcribed string tokens (value + unit), never calculated numbers; the
 * deterministic normalizer resolves units and enforces integrity.
 */

import { z } from 'zod';

const rawAmountSchema = z
  .object({
    value: z.string(),
    unit: z.string(),
  })
  .strict()
  .nullable();

export const rawMacroCardOcrSchema = z
  .object({
    cardDetected: z.boolean(),
    itemName: z.string().nullable().optional(),
    servingSizeDescription: z.string().nullable().optional(),
    evidence: z.string().nullable().optional(),
    calories: rawAmountSchema.optional(),
    proteinGrams: rawAmountSchema.optional(),
    carbsGrams: rawAmountSchema.optional(),
    fatGrams: rawAmountSchema.optional(),
    fiberGrams: rawAmountSchema.optional(),
    confidence: z.enum(['high', 'medium', 'low']).nullable().optional(),
  })
  .strict();

export type RawMacroCardOcr = z.infer<typeof rawMacroCardOcrSchema>;
export type RawCardAmount = z.infer<typeof rawAmountSchema>;
