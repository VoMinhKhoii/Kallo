/**
 * Shared constants, types, DB connection, and category definitions
 * for the USDA Vietnamese translation pipeline.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { encodeDbUrl } from '@/lib/db';
import * as schema from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// 13 in-scope USDA categories
// ---------------------------------------------------------------------------

export const IN_SCOPE_CATEGORIES = [
  'Beef Products',
  'Vegetables and Vegetable Products',
  'Lamb, Veal, and Game Products',
  'Poultry Products',
  'Fruits and Fruit Juices',
  'Pork Products',
  'Dairy and Egg Products',
  'Legumes and Legume Products',
  'Finfish and Shellfish Products',
  'Fats and Oils',
  'Cereal Grains and Pasta',
  'Nut and Seed Products',
  'Spices and Herbs',
] as const;

export type InScopeCategory = (typeof IN_SCOPE_CATEGORIES)[number];

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
