/**
 * Shared constants, types, DB connection, and category definitions
 * for the USDA Vietnamese translation pipeline.
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { encodeDbUrl } from '@/lib/db';
import * as schema from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// In-scope USDA categories — derived from the DB, not hardcoded
// ---------------------------------------------------------------------------

/**
 * Every category that still contains untranslated rows. The original 13-item
 * hardcoded list is exactly why 2,186 of 6,945 USDA rows (31%) were never
 * translated: whole groups (Baked Products, Beverages, Sweets, Soups/Sauces/
 * Gravies — where instant ramen lives — Breakfast Cereals, Sausages, Other)
 * were simply never in scope, which surfaced as the mì-gói zero-candidates
 * incident. Deriving the scope from the untranslated predicate itself makes
 * the pipeline self-scoping forever: any future import lands in scope
 * automatically, and a fully-translated DB yields an empty (no-op) run.
 *
 * The `name_alt IS NULL` clause is what lets loanwords finish: for Miso,
 * Natto, Wasabi, Tempeh, Eggnog & co. the correct Vietnamese name IS the
 * English name, so `name_primary = name_en` alone would keep them in scope
 * (and the CI verify step red) forever. Phase 2's name_alt variants are the
 * durable "this row has been through the pipeline" marker.
 */
export async function resolveInScopeCategories(): Promise<string[]> {
  const db = getDb();
  const rows = (await db.execute(
    sql.raw(`
      SELECT DISTINCT type_en
      FROM vietnamese_food_composition
      WHERE source_id = 2 AND name_primary = name_en AND name_alt IS NULL
      ORDER BY type_en
    `)
  )) as unknown as Array<{ type_en: string }>;
  return rows.map((r) => r.type_en);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranslationResult {
  name_primary_vi: string;
}

export interface NameAltResult {
  name_alt: string[];
}

export interface FoodItem {
  id: string;
  namePrimary: string;
  nameEn: string;
  nameAlt: string[] | null;
  typeVn: string;
  typeEn: string;
}

export interface Checkpoint1 {
  [id: string]: TranslationResult;
}

export interface Checkpoint2 {
  [id: string]: NameAltResult;
}

export interface Checkpoint4 {
  [id: string]: { hash: string };
}

// ---------------------------------------------------------------------------
// DB connection (lazy)
// ---------------------------------------------------------------------------

let _client: ReturnType<typeof postgres> | undefined;
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }
    _client = postgres(encodeDbUrl(url), {
      max: 5,
      prepare: false,
    });
    _db = drizzle(_client, { schema });
  }
  return _db;
}

export async function closeDb() {
  if (_client) {
    await _client.end();
    _client = undefined;
    _db = undefined;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Simple hash for embedding input text to detect changes. */
export function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return hash.toString(36);
}

export function buildEmbeddingText(row: {
  namePrimary: string;
  nameAlt: string[] | null;
  nameEn: string;
  typeVn: string;
  typeEn: string;
}): string {
  const alt = row.nameAlt?.length ? ` ${row.nameAlt.join(' ')}` : '';
  return `${row.namePrimary}${alt} ${row.nameEn} ${row.typeVn} ${row.typeEn}`;
}
