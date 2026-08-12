import { spawn } from 'node:child_process';
import { once } from 'node:events';
import postgres from 'postgres';
import { encodeDbUrl } from '@/lib/db';
import type { ConstructedRow } from './nin-types';

export const NIN_SOURCE_CODE = 'NIN_WEB_2026';

function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is required for database stages');
  return encodeDbUrl(value);
}

export async function applyRows(
  rows: ConstructedRow[],
  options: { reapply?: boolean } = {}
): Promise<string[]> {
  const client = postgres(databaseUrl(), { max: 1 });
  try {
    return await client.begin(async (tx) => {
      if (options.reapply) {
        await tx`
          DELETE FROM vietnamese_food_composition
          WHERE starts_with(id, 'nin_web_')
        `;
      }
      await tx`
        INSERT INTO ingredient_sources (code, name)
        VALUES (${NIN_SOURCE_CODE}, ${'National Institute of Nutrition web snapshot (2026-08-12)'})
        ON CONFLICT (code) DO NOTHING
      `;
      const [source] = await tx<{ id: number }[]>`
        SELECT id FROM ingredient_sources WHERE code = ${NIN_SOURCE_CODE}
      `;
      if (!source) throw new Error('Failed to resolve NIN ingredient source');
      const insertedIds: string[] = [];
      for (const row of rows) {
        let id = row.id;
        let suffix = 1;
        while (
          (await tx`SELECT 1 FROM vietnamese_food_composition WHERE id = ${id}`)
            .length
        ) {
          const existing = await tx<{ source_code: string }[]>`
            SELECT source.code AS source_code
            FROM vietnamese_food_composition AS food
            JOIN ingredient_sources AS source ON source.id = food.source_id
            WHERE food.id = ${id}
          `;
          if (existing[0]?.source_code === NIN_SOURCE_CODE) break;
          suffix++;
          id = `${row.id}_${suffix}`;
        }
        const result = await tx<{ id: string }[]>`
          INSERT INTO vietnamese_food_composition (
            id, name_primary, name_alt, name_en, type_vn, type_en, source_id,
            state, calories_kcal, protein_g, carbohydrate_g, fat_g, fiber_g,
            last_verified
          ) VALUES (
            ${id}, ${row.namePrimary}, ${row.nameAlt}, ${row.nameEn},
            ${row.typeVn}, ${row.typeEn}, ${source.id}, ${row.state},
            ${row.caloriesKcal}, ${row.proteinG}, ${row.carbohydrateG},
            ${row.fatG}, ${row.fiberG}, ${'2026-08-12'}
          )
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `;
        if (result[0]) insertedIds.push(result[0].id);
      }
      return insertedIds;
    });
  } finally {
    await client.end();
  }
}

export async function runEmbeddingBackfill(ids: string[]): Promise<void> {
  if (ids.length === 0)
    throw new Error('No inserted ids available for embedding');
  const child = spawn(
    'bun',
    ['scripts/backfill_embeddings.ts', `--ids=${ids.join(',')}`],
    { stdio: 'inherit', env: process.env }
  );
  const [code] = (await once(child, 'exit')) as [number | null];
  if (code !== 0) throw new Error(`Embedding backfill exited with ${code}`);
}
