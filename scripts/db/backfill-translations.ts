/**
 * Backfill missing translations in ingredient_query_embeddings.
 *
 * Bidirectional:
 *  - Rows with name_vi but no name_en → translate vi→en
 *  - Rows with name_en but no name_vi → translate en→vi (future English users)
 *
 * Uses Google Cloud Translation API (free tier: 500k chars/month).
 *
 * Usage:
 *   bun --env-file=.env.local scripts/db/backfill-translations.ts
 *   bun --env-file=.env.local scripts/db/backfill-translations.ts --dry-run
 *
 * Requires env vars: DATABASE_URL, GOOGLE_TRANSLATE_API_KEY
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { encodeDbUrl } from '@/lib/infra/db';

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1_000;
const MAX_RETRIES = 3;

const DRY_RUN = process.argv.includes('--dry-run');

if (!process.env.DATABASE_URL || !process.env.GOOGLE_TRANSLATE_API_KEY) {
  console.error(
    'Missing DATABASE_URL or GOOGLE_TRANSLATE_API_KEY. Run with:',
    '\n  bun --env-file=.env.local scripts/db/backfill-translations.ts'
  );
  process.exit(1);
}

const client = postgres(encodeDbUrl(process.env.DATABASE_URL));
const db = drizzle(client);
const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

interface TranslationRow {
  name_vi: string | null;
  name_en: string | null;
}

async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
  retries = 0
): Promise<string | null> {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: 'text',
      }),
    });

    if (res.status === 429 && retries < MAX_RETRIES) {
      const retryAfter =
        Number.parseInt(res.headers.get('retry-after') || '5', 10) * 1000;
      console.warn(
        `Rate limited, retrying in ${retryAfter / 1000}s (attempt ${retries + 1}/${MAX_RETRIES})`
      );
      await sleep(retryAfter);
      return translateText(text, sourceLang, targetLang, retries + 1);
    }

    if (!res.ok) {
      console.error(`Translation API error ${res.status}: ${await res.text()}`);
      return null;
    }

    const json = (await res.json()) as {
      data: { translations: { translatedText: string }[] };
    };
    return json.data.translations[0]?.translatedText ?? null;
  } catch (err) {
    console.error(`Translation failed for "${text}":`, err);
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function backfillDirection(
  direction: 'vi-to-en' | 'en-to-vi'
): Promise<number> {
  const isViToEn = direction === 'vi-to-en';
  const sourceCol = isViToEn ? 'name_vi' : 'name_en';
  const targetCol = isViToEn ? 'name_en' : 'name_vi';
  const sourceLang = isViToEn ? 'vi' : 'en';
  const targetLang = isViToEn ? 'en' : 'vi';

  console.log(`\n--- Backfilling ${direction} ---`);

  const rows = (await db.execute(
    sql.raw(
      `SELECT name_vi, name_en FROM ingredient_query_embeddings WHERE ${targetCol} IS NULL AND ${sourceCol} IS NOT NULL`
    )
  )) as unknown as TranslationRow[];

  console.log(`Found ${rows.length} rows needing ${direction} translation`);

  if (DRY_RUN) {
    for (const row of rows.slice(0, 10)) {
      const source = isViToEn ? row.name_vi : row.name_en;
      console.log(`  [dry-run] Would translate: "${source}"`);
    }
    if (rows.length > 10) console.log(`  ... and ${rows.length - 10} more`);
    return 0;
  }

  let updated = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    console.log(
      `Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (${batch.length} items)`
    );

    for (const row of batch) {
      const sourceText = isViToEn ? row.name_vi : row.name_en;
      if (!sourceText) continue;

      const translated = await translateText(
        sourceText,
        sourceLang,
        targetLang
      );
      if (!translated) continue;

      const pkValue = sourceText;
      if (!pkValue) continue;

      await db.execute(
        sql.raw(
          `UPDATE ingredient_query_embeddings SET ${targetCol} = '${translated.replace(/'/g, "''")}' WHERE ${sourceCol} = '${pkValue.replace(/'/g, "''")}'`
        )
      );
      updated++;
    }

    if (i + BATCH_SIZE < rows.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return updated;
}

async function main() {
  console.log(
    DRY_RUN
      ? '🔍 DRY RUN MODE — no changes will be made'
      : '🚀 Running translations'
  );

  const viToEn = await backfillDirection('vi-to-en');
  const enToVi = await backfillDirection('en-to-vi');

  console.log(`\n✅ Done. Updated: ${viToEn} vi→en, ${enToVi} en→vi`);

  await client.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
