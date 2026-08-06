/**
 * Phase 2: Gemini Flash LLM — generate Vietnamese name_alt[] variants.
 *
 * Uses gemini-3-flash-preview with 10 API keys rotating round-robin.
 * Groups items by category, ~25 per prompt.
 * Saves to checkpoint-2.json per batch.
 */

import { sql } from 'drizzle-orm';
import { loadCheckpoint, mergeAndSave } from './checkpoints';
import {
  allKeysDailyExhausted,
  cooldownKey,
  loadGeminiKeys,
  pickKey,
  recordCall,
} from './keys';
import {
  type Checkpoint1,
  type Checkpoint2,
  getDb,
  resolveInScopeCategories,
  sleep,
} from './shared';

const MODEL = 'gemini-3-flash-preview';
const ITEMS_PER_PROMPT = 25;
const MAX_PARSE_RETRIES = 4;
// 15 RPM per key → 4s between calls on same key
const MIN_KEY_INTERVAL_MS = 4_200;

const SYSTEM_PROMPT = `You are a Vietnamese food naming expert. Given USDA food composition entries, generate 2-4 Vietnamese alternative names (name_alt) that Vietnamese home cooks would actually use when describing this food.

USDA Modifier → Vietnamese Cooking Language:
- "meat only" → "bỏ da bỏ mỡ" or "chỉ thịt nạc"
- "skinless, boneless" → "không da không xương" or "lọc xương bỏ da"
- "separable lean only" → "phần nạc" or "chỉ nạc"
- "separable lean and fat" → "nạc và mỡ" or "cả nạc lẫn mỡ"
- "trimmed to 0" fat" → "cắt bỏ mỡ" or "bỏ hết mỡ"
- "raw" → (omit — Vietnamese rarely specifies this)
- "cooked, braised" → "kho" or "hầm"
- "cooked, grilled" → "nướng"
- "cooked, roasted" → "quay"

Examples from existing FAO Vietnamese entries:
- "Thịt gà ta" → name_alt: ["gà ta", "gà thả vườn"]
- "Thịt lợn nạc" → name_alt: ["thịt heo nạc", "nạc heo", "nạc lợn"]
- "Cá hồi" → name_alt: ["cá hồi tươi", "phi lê cá hồi"]

Rules:
- Start each variant with the Vietnamese food name (e.g., "ức gà", "ba chỉ", "cá hồi")
- Include preparation modifiers that match the USDA entry's state
- Use BOTH Northern (lợn) and Southern (heo) Vietnamese terms where applicable
- Keep variants short (2-5 words each)
- Do NOT include cooking methods unless the USDA entry specifies a cooked state
- Output ONLY a valid JSON array, no markdown fences, no explanation`;

interface NameAltItem {
  fdc_id: string;
  name_alt: string[];
}

function buildPrompt(
  category: string,
  items: { id: string; name_en: string }[]
): string {
  const itemList = items.map((i) => ({
    fdc_id: i.id,
    name_en: i.name_en,
  }));
  return JSON.stringify({ category, items: itemList });
}

function parseResponse(
  raw: string,
  expectedIds: Set<string>
): { parsed: NameAltItem[]; missing: string[] } | null {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '');
  }

  let parsed: NameAltItem[];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to recover truncated JSON — find last complete object and close the array
    const lastCompleteObj = cleaned.lastIndexOf('}');
    if (lastCompleteObj > 0) {
      const recovered = `${cleaned.slice(0, lastCompleteObj + 1)}]`;
      try {
        parsed = JSON.parse(recovered);
        console.warn(
          `    [parse] Recovered truncated JSON (${cleaned.length} → ${recovered.length} chars)`
        );
      } catch {
        console.warn(
          `    [parse-debug] Unrecoverable. Last 200 chars: ${cleaned.slice(-200)}`
        );
        console.warn(`    [parse-debug] Total length: ${cleaned.length}`);
        return null;
      }
    } else {
      console.warn(`    [parse-debug] No valid JSON structure found`);
      return null;
    }
  }

  // Handle object wrapper: { "items": [...] } or { "results": [...] } etc.
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const values = Object.values(parsed as Record<string, unknown>);
    const arrValue = values.find((v) => Array.isArray(v));
    if (arrValue) {
      parsed = arrValue as NameAltItem[];
    } else {
      console.warn(
        '    [parse-debug] Got non-array object with no array value'
      );
      return null;
    }
  }

  if (!Array.isArray(parsed)) return null;

  // Validate each item
  const validItems: NameAltItem[] = [];
  const seenIds = new Set<string>();
  for (const item of parsed) {
    // Guard against non-object values in malformed LLM output
    if (item === null || typeof item !== 'object' || Array.isArray(item))
      continue;
    if (
      !item.fdc_id ||
      !expectedIds.has(item.fdc_id) ||
      !Array.isArray(item.name_alt)
    ) {
      continue;
    }
    if (seenIds.has(item.fdc_id)) continue;
    // Deduplicate, filter empty strings, and cap at 4 variants
    const alts = [
      ...new Set(
        item.name_alt
          .filter((s: unknown) => typeof s === 'string' && s.trim().length > 0)
          .map((s: string) => s.trim())
      ),
    ];
    if (alts.length === 0) continue;
    if (alts.length > 4) {
      console.warn(
        `  ⚠ ${item.fdc_id}: ${alts.length} variants, truncating to 4`
      );
    }
    validItems.push({ fdc_id: item.fdc_id, name_alt: alts.slice(0, 4) });
    seenIds.add(item.fdc_id);
  }

  const missing = [...expectedIds].filter((id) => !seenIds.has(id));
  return { parsed: validItems, missing };
}

interface Phase2Options {
  dryRun: boolean;
  category?: string;
}

export async function runPhase2(opts: Phase2Options): Promise<Checkpoint2> {
  console.log('\n═══ Phase 2: Gemini Flash (name_alt generation) ═══');

  const db = getDb();
  let checkpoint = loadCheckpoint<Checkpoint2>('checkpoint-2.json');
  const existingCount = Object.keys(checkpoint).length;
  if (existingCount > 0) {
    console.log(`  Resuming: ${existingCount} items already in checkpoint`);
  }

  // Load Phase 1 checkpoint to know which items were translated
  const cp1 = loadCheckpoint<Checkpoint1>('checkpoint-1.json');
  const translatedIds = new Set(Object.keys(cp1));
  if (translatedIds.size === 0) {
    console.log('  ⚠ No Phase 1 translations found. Run Phase 1 first.');
    return checkpoint;
  }

  const categoryFilter = opts.category
    ? [opts.category]
    : await resolveInScopeCategories();

  // Fetch items that have Phase 1 translations but no Phase 2 name_alt yet
  const catPlaceholders = categoryFilter
    .map((c) => `'${c.replace(/'/g, "''")}'`)
    .join(',');

  const rows = (await db.execute(
    sql.raw(`
      SELECT id, name_en, type_en
      FROM vietnamese_food_composition
      WHERE source_id = 2
        AND type_en IN (${catPlaceholders})
      ORDER BY type_en, id
    `)
  )) as unknown as { id: string; name_en: string; type_en: string }[];

  // Only process items that have Phase 1 translations but no Phase 2 checkpoint
  const pending = rows.filter(
    (r) => translatedIds.has(r.id) && !checkpoint[r.id]
  );

  console.log(
    `  ${rows.length} in-scope items, ${pending.length} need name_alt generation`
  );

  if (pending.length === 0) {
    console.log('  ✓ Phase 2 complete (all items already processed)');
    return checkpoint;
  }

  if (opts.dryRun) {
    console.log(
      `  [dry-run] Would generate name_alt for ${pending.length} items`
    );
    const categories = [...new Set(pending.map((r) => r.type_en))];
    for (const cat of categories) {
      const count = pending.filter((r) => r.type_en === cat).length;
      console.log(
        `    ${cat}: ${count} items → ${Math.ceil(count / ITEMS_PER_PROMPT)} prompts`
      );
    }
    return checkpoint;
  }

  // Keys are loaded only when we actually make model calls
  const keys = loadGeminiKeys();

  // Group by category
  const byCategory = new Map<string, typeof pending>();
  for (const row of pending) {
    const list = byCategory.get(row.type_en) || [];
    list.push(row);
    byCategory.set(row.type_en, list);
  }

  let keyIdx = 0;
  let totalPrompts = 0;
  let totalItems = 0;

  for (const [category, items] of byCategory) {
    const batches = [];
    for (let i = 0; i < items.length; i += ITEMS_PER_PROMPT) {
      batches.push(items.slice(i, i + ITEMS_PER_PROMPT));
    }

    console.log(
      `\n  📂 ${category}: ${items.length} items → ${batches.length} prompts`
    );

    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
      const batch = batches[bIdx];
      const expectedIds = new Set(batch.map((r) => r.id));
      const prompt = buildPrompt(category, batch);

      let batchDone = false;
      for (let attempt = 0; attempt <= MAX_PARSE_RETRIES && !batchDone; ) {
        // Pick an available key — wait outside parse retry budget
        let slot = pickKey(keys, keyIdx);
        while (!slot) {
          if (allKeysDailyExhausted(keys)) {
            throw new Error(
              'All Gemini API keys have reached daily request limit. Re-run tomorrow or add more keys.'
            );
          }
          console.warn('  All keys on cooldown, waiting 35s...');
          await sleep(35_000);
          slot = pickKey(keys, keyIdx);
        }

        // Respect per-key rate limit
        const timeSinceLast = Date.now() - slot.lastCallAt;
        if (timeSinceLast < MIN_KEY_INTERVAL_MS) {
          await sleep(MIN_KEY_INTERVAL_MS - timeSinceLast);
        }

        try {
          const result = await slot.client.models.generateContent({
            model: MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              systemInstruction: SYSTEM_PROMPT,
              temperature: 0.3,
              maxOutputTokens: 8192,
            },
          });

          recordCall(slot);
          keyIdx = (keys.indexOf(slot) + 1) % keys.length;

          const text = result.text ?? '';
          const parsed = parseResponse(text, expectedIds);

          if (!parsed) {
            attempt++;
            if (attempt > MAX_PARSE_RETRIES) {
              console.error(
                `    ✗ Parse failed after ${MAX_PARSE_RETRIES + 1} attempts, skipping batch`
              );
              break;
            }
            console.warn(`    Parse failure (attempt ${attempt}), retrying...`);
            continue;
          }

          if (parsed.missing.length > 0) {
            console.warn(
              `    ⚠ ${parsed.missing.length} missing IDs in response (will retry in next run)`
            );
          }

          // Save valid results
          const newEntries: Record<string, { name_alt: string[] }> = {};
          for (const item of parsed.parsed) {
            newEntries[item.fdc_id] = { name_alt: item.name_alt };
            if (item.name_alt.length < 2) {
              console.warn(
                `    ⚠ ${item.fdc_id}: only ${item.name_alt.length} variant(s)`
              );
            }
          }

          checkpoint = mergeAndSave(
            'checkpoint-2.json',
            checkpoint,
            newEntries
          );
          totalItems += parsed.parsed.length;
          batchDone = true;
        } catch (err: unknown) {
          const errObj = err as { message?: string; status?: number };
          const is429 =
            errObj.message?.includes('429') || errObj.status === 429;
          const is5xx =
            (errObj.status ?? 0) >= 500 ||
            errObj.message?.includes('503') ||
            errObj.message?.includes('UNAVAILABLE');

          if (is429 || is5xx) {
            // Attempt to extract Retry-After from the SDK error response.
            // The Gemini SDK may expose response headers via errObj.response?.headers.
            // Fall back to 0 (uses COOLDOWN_MS baseline) if headers are unavailable.
            const errWithHeaders = err as {
              response?: { headers?: Record<string, string> };
            };
            const retryAfterHeader =
              errWithHeaders.response?.headers?.['retry-after'] ??
              errWithHeaders.response?.headers?.['Retry-After'];
            let retryAfterMs = 0;
            if (retryAfterHeader) {
              const delta = Number(retryAfterHeader);
              retryAfterMs = Number.isFinite(delta) ? delta * 1000 : 0;
            }
            cooldownKey(slot, retryAfterMs);
            keyIdx = (keys.indexOf(slot) + 1) % keys.length;
            // Don't burn a parse attempt on rate-limit errors
            const backoff = is5xx ? 10_000 : 5_000;
            console.warn(
              `    ${is5xx ? '503/5xx' : '429'} on key ${slot.index}, retrying in ${backoff / 1000}s...`
            );
            await sleep(backoff);
            continue;
          }
          throw err;
        }
      }

      totalPrompts++;
      if (totalPrompts % 10 === 0) {
        console.log(
          `    Progress: ${totalPrompts} prompts, ${totalItems}/${pending.length} items`
        );
      }
    }
  }

  console.log(
    `  ✓ Phase 2 complete: ${Object.keys(checkpoint).length} items with name_alt`
  );
  return checkpoint;
}
