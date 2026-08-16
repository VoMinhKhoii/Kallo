import { createHash } from 'node:crypto';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';

/**
 * Cache-key derivation for the v1 decomposition L4 cache. The cache itself is
 * the generic primitive in `@/lib/ai/cache/l4-cache`; only the key shape below
 * is v1-specific, so it stays in `legacy/` and is deleted with the flag.
 */

const ALLOWED_CONTEXT_KEYS = [
  'countryOfOrigin',
  'countryOfResidence',
  'cookingHabits',
  'inputLanguage',
  'outputLanguage',
] as const;

export function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map(stableStringify).join(',')}]`;
  }

  const record = obj as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(',')}}`;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function decompositionContextHash(
  ctx: Partial<PromptPersonalizationContext>
): string {
  const filtered: Record<string, unknown> = {};
  for (const key of ALLOWED_CONTEXT_KEYS) {
    if (ctx[key] !== undefined) {
      filtered[key] = ctx[key];
    }
  }

  return sha256Hex(stableStringify(filtered));
}

export interface DecompositionCacheKeyInput {
  rawInput: string;
  ctx: Partial<PromptPersonalizationContext>;
  decompositionPromptHash: string;
  decompositionSchemaHash: string;
  decompositionModel: string;
}

export function normalizeRawInput(s: string): string {
  return s.trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');
}

export function buildDecompositionCacheKey(
  input: DecompositionCacheKeyInput
): string {
  const payload = stableStringify({
    raw: normalizeRawInput(input.rawInput),
    ctx: decompositionContextHash(input.ctx),
    pv: input.decompositionPromptHash,
    sv: input.decompositionSchemaHash,
    mv: input.decompositionModel,
  });
  const hash = sha256Hex(payload).slice(0, 48);
  return `l4:dec:${hash}`;
}
