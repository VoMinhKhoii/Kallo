import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { GeminiAttemptMetadata } from '@/lib/ai/provider/provider';
import { db } from '@/lib/db';
import type * as schema from '@/lib/db/schema';

const _untypedDb = db as unknown as PostgresJsDatabase<typeof schema>;
export const DEBUG_LLM_TIMEOUT_MS = 25_000;

/** Extract only the big 4 macros from a nutrition object for debug readability */
export function pickMacros(obj: any) {
  if (!obj) return obj;
  return {
    caloriesKcal: obj.caloriesKcal ?? null,
    proteinG: obj.proteinG ?? null,
    carbohydrateG: obj.carbohydrateG ?? null,
    fatG: obj.fatG ?? null,
  };
}

export function serializeAttempt(metadata: GeminiAttemptMetadata) {
  return {
    attempt: metadata.attempt,
    model: metadata.model,
    inputTokens: metadata.inputTokens,
    outputTokens: metadata.outputTokens,
    error:
      metadata.error instanceof Error
        ? metadata.error.message
        : metadata.error != null
          ? String(metadata.error)
          : null,
  };
}

export interface FuzzyMatchRow {
  id: string;
  name_primary: string;
  name_alt: string[] | null;
  name_en: string;
  state: string;
  similarity: number;
}
