#!/usr/bin/env bun
/**
 * Write the food-card seed migration (see card-sql.ts for what it does).
 *
 *   bun scripts/data/food-cards/build-seed-migration.ts <supabase/migrations/<ts>_seed_food_cards.sql>
 */
import { writeFileSync } from 'node:fs';
import { buildCardSql } from './card-sql';

const out = process.argv[2];
if (!out) throw new Error('usage: build-seed-migration.ts <out.sql>');
const { sql, cards } = buildCardSql();
writeFileSync(out, sql);
console.log(`wrote ${out}: ${cards} cards`);
