import { createHash } from 'node:crypto';
import type { PromptPersonalizationContext } from '../prompts/types';

const ALLOWED_CONTEXT_KEYS = [
  'countryOfOrigin',
  'countryOfResidence',
  'cookingHabits',
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

export interface L4Cache<V> {
  get: (key: string) => V | null;
  set: (key: string, value: V) => void;
  size: () => number;
  clear: () => void;
}

export interface L4CacheConfig {
  maxEntries: number;
  ttlMs: number;
  now?: () => number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export function createL4Cache<V>(cfg: L4CacheConfig): L4Cache<V> {
  const now = cfg.now ?? (() => Date.now());
  const map = new Map<string, Entry<V>>();

  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) {
        return null;
      }
      if (entry.expiresAt <= now()) {
        map.delete(key);
        return null;
      }

      map.delete(key);
      map.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      if (map.has(key)) {
        map.delete(key);
      }
      map.set(key, { value, expiresAt: now() + cfg.ttlMs });
      while (map.size > cfg.maxEntries) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) {
          break;
        }
        map.delete(oldest);
      }
    },
    size: () => map.size,
    clear: () => map.clear(),
  };
}
