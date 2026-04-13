/**
 * Phase 4: Re-embed — regenerate embeddings for items updated in Phase 3.
 *
 * Uses gemini-embedding-001 with 10 API keys rotating round-robin.
 * Tracks embedding input hash in checkpoint-4.json for change detection.
 */

import { sql } from 'drizzle-orm';
import { loadCheckpoint, mergeAndSave } from './checkpoints';
import {
  cooldownKey,
  type KeySlot,
  loadGeminiKeys,
  pickKey,
  recordCall,
} from './keys';
import {
  buildEmbeddingText,
  type Checkpoint4,
  type FoodItem,
  getDb,
  hashText,
  sleep,
} from './shared';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const BATCH_SIZE = 50;
const MAX_RETRIES = 5;

interface Phase4Options {
  dryRun: boolean;
  category?: string;
  updatedIds?: string[];
}

async function embedBatch(texts: string[], slot: KeySlot): Promise<number[][]> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await slot.client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: texts.map((text) => ({ parts: [{ text }] })),
        config: { outputDimensionality: 768 },
      });
      recordCall(slot, texts.length);
      return result.embeddings!.map((e) => e.values!);
    } catch (err: unknown) {
      const errObj = err as { message?: string; status?: number };
      if (errObj.message?.includes('429') || errObj.status === 429) {
        const retryMatch = errObj.message?.match(/retry in ([\d.]+)s/i);
        const retryAfterMs = retryMatch
          ? Math.ceil(Number.parseFloat(retryMatch[1]) * 1000)
          : 0;
        cooldownKey(slot, retryAfterMs);
        if (attempt === MAX_RETRIES) throw err;
        const delay = retryMatch
          ? Math.ceil(Number.parseFloat(retryMatch[1]) * 1000) + 1000
          : 1000 * 2 ** attempt;
        console.warn(
          `    Retry ${attempt}/${MAX_RETRIES} in ${(delay / 1000).toFixed(0)}s (key ${slot.index})`
        );
        await sleep(delay);
        continue;
      }
      if (attempt === MAX_RETRIES) throw err;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw new Error('unreachable');
}

async function updateEmbeddingBatch(
  ids: string[],
  embeddings: number[][]
): Promise<void> {
  const db = getDb();
  const rows = ids.map((id, i) => {
    const vec = `[${embeddings[i].join(',')}]`;
    const safeId = id.replace(/'/g, "''");
    return `('${safeId}', '${vec}'::vector(768))`;
  });

  await db.execute(
    sql.raw(`
      UPDATE vietnamese_food_composition AS vfc
      SET embedding = data.vec
      FROM (VALUES ${rows.join(',')}) AS data(id, vec)
      WHERE vfc.id = data.id
    `)
  );
}

export async function runPhase4(opts: Phase4Options): Promise<void> {
  console.log('\n═══ Phase 4: Re-embed (gemini-embedding-001) ═══');

  const keys = loadGeminiKeys();
  const db = getDb();

  let checkpoint = loadCheckpoint<Checkpoint4>('checkpoint-4.json');
  const existingCount = Object.keys(checkpoint).length;
  if (existingCount > 0) {
    console.log(`  Resuming: ${existingCount} items already embedded`);
  }

  // Determine which items need re-embedding
  let idFilter: string;
  if (opts.updatedIds && opts.updatedIds.length > 0) {
    const idList = opts.updatedIds
      .map((id) => `'${id.replace(/'/g, "''")}'`)
      .join(',');
    idFilter = `AND id IN (${idList})`;
  } else if (opts.category) {
    idFilter = `AND type_en = '${opts.category.replace(/'/g, "''")}'`;
  } else {
    // Re-embed all USDA items where name_primary != name_en (already translated)
    idFilter = 'AND name_primary != name_en';
  }

  const rows = (await db.execute(
    sql.raw(`
      SELECT id, name_primary, name_alt, name_en, type_vn, type_en
      FROM vietnamese_food_composition
      WHERE source_id = 2 ${idFilter}
      ORDER BY id
    `)
  )) as unknown as FoodItem[];

  // Filter: only re-embed if embedding input changed (hash mismatch)
  const pending: { item: FoodItem; text: string; hash: string }[] = [];
  for (const row of rows) {
    const text = buildEmbeddingText(row);
    const h = hashText(text);
    if (checkpoint[row.id]?.hash === h) continue;
    pending.push({ item: row, text, hash: h });
  }

  console.log(
    `  ${rows.length} translated items, ${pending.length} need re-embedding`
  );

  if (pending.length === 0) {
    console.log('  ✓ Phase 4 complete (all embeddings up to date)');
    return;
  }

  if (opts.dryRun) {
    console.log(`  [dry-run] Would re-embed ${pending.length} items`);
    return;
  }

  const totalBatches = Math.ceil(pending.length / BATCH_SIZE);
  let keyIdx = 0;
  let processed = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    // Pick key with round-robin, respect rate limits
    let slot: KeySlot | null = null;
    let waitAttempts = 0;
    while (!slot && waitAttempts < 20) {
      slot = pickKey(keys, keyIdx);
      if (!slot) {
        console.warn('    All keys on cooldown/exhausted, waiting 10s...');
        await sleep(10_000);
        waitAttempts++;
      }
    }
    if (!slot) {
      console.error(
        '    ✗ All keys exhausted. Checkpoint saved. Resume later.'
      );
      return;
    }

    // Respect per-key rate: 100 req/min → with 50/batch, ~30s between batches on same key
    // With 10 keys round-robin, effective wait is much shorter
    const timeSinceLast = Date.now() - slot.lastCallAt;
    const minInterval = (BATCH_SIZE / 100) * 60_000; // ms needed for this batch count
    if (timeSinceLast < minInterval) {
      await sleep(minInterval - timeSinceLast);
    }

    const texts = batch.map((b) => b.text);
    const embeddings = await embedBatch(texts, slot);
    await updateEmbeddingBatch(
      batch.map((b) => b.item.id),
      embeddings
    );

    // Update checkpoint with hashes
    const newEntries: Record<string, { hash: string }> = {};
    for (const b of batch) {
      newEntries[b.item.id] = { hash: b.hash };
    }
    checkpoint = mergeAndSave('checkpoint-4.json', checkpoint, newEntries);

    processed += batch.length;
    keyIdx = (keys.indexOf(slot) + 1) % keys.length;

    if (batchNum % 5 === 0 || batchNum === totalBatches) {
      console.log(
        `  Batch ${batchNum}/${totalBatches}: ${processed}/${pending.length} embedded (key ${slot.index})`
      );
    }
  }

  console.log(`  ✓ Phase 4 complete: ${processed} embeddings regenerated`);
}
