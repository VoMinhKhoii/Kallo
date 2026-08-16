/**
 * Gemini client slots for round-robin load distribution.
 *
 * Two providers, selected by AI_PROVIDER (same contract as lib/ai/provider/client.ts):
 *   - "vertex":    ONE slot backed by Vertex AI via Application Default
 *                  Credentials (GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION).
 *                  No API keys. This is what production inference uses, and
 *                  its quota is billed rather than free-tier capped.
 *   - "ai-studio": reads GEMINI_API_KEY_1..20 (or a plain GEMINI_API_KEY) from
 *                  the environment — the local / multi-key path.
 *
 * Tracks per-slot rate limits and rotates on 429.
 */

import { GoogleGenAI } from '@google/genai';

export interface KeySlot {
  index: number;
  /** null on the Vertex path — it authenticates via ADC, not a key. */
  apiKey: string | null;
  client: GoogleGenAI;
  lastCallAt: number;
  cooldownUntil: number;
  dailyRequests: number;
  /**
   * Requests this slot may spend per day before it is considered exhausted.
   *
   * 1000 is NOT a Gemini-wide law — it is the Google AI Studio FREE-tier
   * daily request cap. On Vertex AI (billed, ADC) there is no such daily
   * ceiling, so the limit is Infinity there; hard-coding 1000 would strand
   * ~1,186 embeddings mid-run on a provider that would happily serve them.
   * Per-slot 429 cooldowns still apply on BOTH providers.
   */
  dailyLimit: number;
}

const COOLDOWN_MS = 35_000;
/**
 * Highest numbered AI Studio slot scanned. Exported so the CLI entry guard
 * validates exactly the range this loader reads — they drifted apart once
 * (guard at 10, loader at 20) and rejected valid environments.
 */
export const MAX_NUMBERED_KEYS = 20;
const AI_STUDIO_FREE_TIER_DAILY_LIMIT = 1000;

function loadVertexSlot(): KeySlot {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim();
  if (!project || !location) {
    throw new Error(
      'AI_PROVIDER=vertex requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION'
    );
  }
  console.log(`  Using Vertex AI (project=${project}, location=${location})`);
  return {
    index: 0,
    apiKey: null,
    client: new GoogleGenAI({ vertexai: true, project, location }),
    lastCallAt: 0,
    cooldownUntil: 0,
    dailyRequests: 0,
    dailyLimit: Number.POSITIVE_INFINITY,
  };
}

export function loadGeminiKeys(): KeySlot[] {
  if (process.env.AI_PROVIDER?.trim() === 'vertex') {
    return [loadVertexSlot()];
  }

  const slots: KeySlot[] = [];
  for (let i = 1; i <= MAX_NUMBERED_KEYS; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key) {
      slots.push({
        index: i,
        apiKey: key,
        client: new GoogleGenAI({ apiKey: key }),
        lastCallAt: 0,
        cooldownUntil: 0,
        dailyRequests: 0,
        dailyLimit: AI_STUDIO_FREE_TIER_DAILY_LIMIT,
      });
    }
  }
  // Fallback: a plain GEMINI_API_KEY (the name every other script and the
  // deploy workflow already use) counts as slot 0 — no numbered alias needed
  // to run this pipeline locally or in CI with a single key.
  if (slots.length === 0 && process.env.GEMINI_API_KEY) {
    slots.push({
      index: 0,
      apiKey: process.env.GEMINI_API_KEY,
      client: new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }),
      lastCallAt: 0,
      cooldownUntil: 0,
      dailyRequests: 0,
      dailyLimit: AI_STUDIO_FREE_TIER_DAILY_LIMIT,
    });
  }
  if (slots.length === 0) {
    throw new Error(
      'No Gemini key found in env (checked GEMINI_API_KEY_1..20, GEMINI_API_KEY)'
    );
  }
  console.log(`  Loaded ${slots.length} Gemini API keys`);
  return slots;
}

/**
 * Pick the next available key, respecting cooldowns.
 * Round-robin starting from `startIdx`.
 */
export function pickKey(slots: KeySlot[], startIdx: number): KeySlot | null {
  const now = Date.now();
  for (let offset = 0; offset < slots.length; offset++) {
    const slot = slots[(startIdx + offset) % slots.length];
    if (slot.cooldownUntil > now) continue;
    if (slot.dailyRequests >= slot.dailyLimit) continue;
    return slot;
  }
  return null;
}

/** Mark a key as rate-limited (429). Uses the greater of baseline or retryAfterMs. */
export function cooldownKey(slot: KeySlot, retryAfterMs = 0) {
  const cooldownMs = Math.max(COOLDOWN_MS, retryAfterMs);
  slot.cooldownUntil = Date.now() + cooldownMs;
  console.warn(
    `  ⚠ Key ${slot.index} rate-limited, cooling down ${(cooldownMs / 1000).toFixed(0)}s`
  );
}

/** Returns true if every key has hit its daily request limit. */
export function allKeysDailyExhausted(slots: KeySlot[]): boolean {
  return slots.every((s) => s.dailyRequests >= s.dailyLimit);
}

/** Record a successful API call on a key. */
export function recordCall(slot: KeySlot, requestCount = 1) {
  slot.lastCallAt = Date.now();
  slot.dailyRequests += requestCount;
}
