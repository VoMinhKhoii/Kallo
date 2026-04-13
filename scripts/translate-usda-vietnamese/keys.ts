/**
 * Gemini API key rotation for round-robin load distribution.
 *
 * Reads GEMINI_API_KEY_1 through GEMINI_API_KEY_10 from environment.
 * Tracks per-key rate limits and rotates on 429.
 */

import { GoogleGenAI } from '@google/genai';

export interface KeySlot {
  index: number;
  apiKey: string;
  client: GoogleGenAI;
  lastCallAt: number;
  cooldownUntil: number;
  dailyRequests: number;
}

const COOLDOWN_MS = 35_000;

export function loadGeminiKeys(): KeySlot[] {
  const slots: KeySlot[] = [];
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key) {
      slots.push({
        index: i,
        apiKey: key,
        client: new GoogleGenAI({ apiKey: key }),
        lastCallAt: 0,
        cooldownUntil: 0,
        dailyRequests: 0,
      });
    }
  }
  if (slots.length === 0) {
    throw new Error(
      'No GEMINI_API_KEY_N found in env (checked GEMINI_API_KEY_1..10)'
    );
  }
  console.log(`  Loaded ${slots.length} Gemini API keys`);
  return slots;
}

/**
 * Pick the next available key, respecting cooldowns.
 * Round-robin starting from `startIdx`.
 */
export function pickKey(
  slots: KeySlot[],
  startIdx: number,
  dailyLimit = 1000
): KeySlot | null {
  const now = Date.now();
  for (let offset = 0; offset < slots.length; offset++) {
    const slot = slots[(startIdx + offset) % slots.length];
    if (slot.cooldownUntil > now) continue;
    if (slot.dailyRequests >= dailyLimit) continue;
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

/** Record a successful API call on a key. */
export function recordCall(slot: KeySlot, requestCount = 1) {
  slot.lastCallAt = Date.now();
  slot.dailyRequests += requestCount;
}
