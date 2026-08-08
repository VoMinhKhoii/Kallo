/**
 * Phase 1: Google Cloud Translation v2 — batch translate name_en → Vietnamese.
 *
 * Batches up to 128 strings per API call.
 * Saves progress to checkpoint-1.json after each batch.
 */

import { sql } from 'drizzle-orm';
import { loadCheckpoint, mergeAndSave } from './checkpoints';
import {
  type Checkpoint1,
  getDb,
  resolveInScopeCategories,
  sleep,
} from './shared';

const BATCH_SIZE = 128;
const BATCH_DELAY_MS = 100;
const MAX_RETRIES = 3;

interface TranslateOptions {
  dryRun: boolean;
  category?: string;
}

async function translateBatch(
  texts: string[],
  apiKey: string,
  retries = 0
): Promise<string[]> {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: texts,
      source: 'en',
      target: 'vi',
      format: 'text',
    }),
  });

  if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
    if (retries >= MAX_RETRIES) {
      const body = await res.text();
      throw new Error(
        `Google Translate API error ${res.status} after ${MAX_RETRIES} retries: ${body}`
      );
    }
    const retryAfterRaw = res.headers.get('retry-after') || '5';
    let retryAfterMs: number;
    const parsed = Number.parseInt(retryAfterRaw, 10);
    if (!Number.isNaN(parsed) && String(parsed) === retryAfterRaw.trim()) {
      retryAfterMs = parsed * 1000;
    } else {
      // Try HTTP-date format
      const date = Date.parse(retryAfterRaw);
      retryAfterMs = Number.isNaN(date) ? 5000 : Math.max(0, date - Date.now());
    }
    const delay = Math.max(retryAfterMs, 1000 * 2 ** retries);
    console.warn(
      `  Retry ${retries + 1}/${MAX_RETRIES} in ${(delay / 1000).toFixed(0)}s (status ${res.status})`
    );
    await sleep(delay);
    return translateBatch(texts, apiKey, retries + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Translate API error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    data: { translations: { translatedText: string }[] };
  };
  return json.data.translations.map((t) => t.translatedText);
}

export async function runPhase1(opts: TranslateOptions): Promise<Checkpoint1> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_TRANSLATE_API_KEY not set');
  }

  console.log('\n═══ Phase 1: Google Translate (name_en → Vietnamese) ═══');

  const db = getDb();
  let checkpoint = loadCheckpoint<Checkpoint1>('checkpoint-1.json');
  const existingCount = Object.keys(checkpoint).length;
  if (existingCount > 0) {
    console.log(`  Resuming: ${existingCount} items already in checkpoint`);
  }

  // Query untranslated USDA items (name_primary still equals name_en)
  const categoryFilter = opts.category
    ? [opts.category]
    : await resolveInScopeCategories();

  // An empty scope means every row is already translated. Interpolating it
  // would emit `type_en IN ()` — a syntax error — so stop here instead.
  if (categoryFilter.length === 0) {
    console.log('  ✓ Phase 1 complete (nothing left untranslated)');
    return checkpoint;
  }

  const catPlaceholders = categoryFilter
    .map((c) => `'${c.replace(/'/g, "''")}'`)
    .join(',');
  const rows = (await db.execute(
    sql.raw(`
      SELECT id, name_en
      FROM vietnamese_food_composition
      WHERE source_id = 2
        AND type_en IN (${catPlaceholders})
        AND name_primary = name_en
        AND name_alt IS NULL
      ORDER BY type_en, id
    `)
  )) as unknown as { id: string; name_en: string }[];

  // Filter out already-checkpointed items
  const pending = rows.filter((r) => !checkpoint[r.id]);
  console.log(
    `  Found ${rows.length} untranslated items, ${pending.length} not yet in checkpoint`
  );

  if (pending.length === 0) {
    console.log('  ✓ Phase 1 complete (all items already translated)');
    return checkpoint;
  }

  if (opts.dryRun) {
    console.log(`  [dry-run] Would translate ${pending.length} items`);
    for (const r of pending.slice(0, 5)) {
      console.log(`    ${r.id}: "${r.name_en.slice(0, 80)}..."`);
    }
    return checkpoint;
  }

  const totalBatches = Math.ceil(pending.length / BATCH_SIZE);
  let totalChars = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const texts = batch.map((r) => r.name_en);
    totalChars += texts.reduce((sum, t) => sum + t.length, 0);

    const translated = await translateBatch(texts, apiKey);

    if (translated.length !== batch.length) {
      throw new Error(
        `Translate API returned ${translated.length}/${batch.length} items`
      );
    }

    // Merge into checkpoint
    const newEntries: Record<string, { name_primary_vi: string }> = {};
    for (let j = 0; j < batch.length; j++) {
      const value = translated[j]?.trim();
      if (!value) {
        throw new Error(`Missing translation for id=${batch[j].id}`);
      }
      newEntries[batch[j].id] = { name_primary_vi: value };
    }
    checkpoint = mergeAndSave('checkpoint-1.json', checkpoint, newEntries);

    console.log(
      `  Batch ${batchNum}/${totalBatches}: ${Object.keys(checkpoint).length} total translated (${totalChars.toLocaleString()} chars)`
    );

    if (i + BATCH_SIZE < pending.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(
    `  ✓ Phase 1 complete: ${Object.keys(checkpoint).length} translations, ${totalChars.toLocaleString()} chars total`
  );
  return checkpoint;
}
