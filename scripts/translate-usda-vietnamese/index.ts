#!/usr/bin/env bun

/**
 * USDA Vietnamese Translation Pipeline
 *
 * 4-phase pipeline to translate USDA food items from English to Vietnamese:
 *   Phase 1: Google Cloud Translation v2 → name_primary (Vietnamese)
 *   Phase 2: Gemini Flash LLM → name_alt[] (Vietnamese cooking variants)
 *   Phase 3: DB Update → write both fields, trigger rebuilds search_text
 *   Phase 4: Re-embed → regenerate embeddings from updated search_text
 *
 * Usage:
 *   bun --env-file=.env.local scripts/translate-usda-vietnamese/index.ts
 *   bun --env-file=.env.local scripts/translate-usda-vietnamese/index.ts --phase=1
 *   bun --env-file=.env.local scripts/translate-usda-vietnamese/index.ts --phase=2 --category="Beef Products"
 *   bun --env-file=.env.local scripts/translate-usda-vietnamese/index.ts --dry-run
 *   bun --env-file=.env.local scripts/translate-usda-vietnamese/index.ts --resume
 *
 * Environment variables:
 *   GOOGLE_TRANSLATE_API_KEY — Google Cloud Translation API key
 *   GEMINI_API_KEY           — single Gemini key, or GEMINI_API_KEY_1..10 for
 *                              10 keys across different GCP projects
 *   DATABASE_URL             — Supabase connection string
 */

import { loadCheckpoint, saveCheckpoint } from './checkpoints';
import { runPhase1 } from './phase1-translate';
import { runPhase2 } from './phase2-name-alt';
import { runPhase3 } from './phase3-db-update';
import { runPhase4 } from './phase4-reembed';
import { closeDb } from './shared';

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = args.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

const phaseArg = getArg('phase');
const phase = phaseArg ? Number.parseInt(phaseArg, 10) : null;

if (phaseArg && ![1, 2, 3, 4].includes(phase ?? -1)) {
  console.error('Invalid --phase. Use --phase=1, 2, 3, or 4.');
  process.exit(1);
}

const category = getArg('category');
const dryRun = args.includes('--dry-run');
const resume = args.includes('--resume');

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

if (!process.env.DATABASE_URL) {
  console.error(
    'Missing DATABASE_URL. Run with:\n  bun --env-file=.env.local scripts/translate-usda-vietnamese/index.ts'
  );
  process.exit(1);
}

if ((!phase || phase === 1) && !process.env.GOOGLE_TRANSLATE_API_KEY) {
  console.error('Missing GOOGLE_TRANSLATE_API_KEY (needed for Phase 1)');
  process.exit(1);
}

const needsGemini = !phase || phase === 2 || phase === 4;
const hasGeminiKey =
  !!process.env.GEMINI_API_KEY_1 || !!process.env.GEMINI_API_KEY;
if (needsGemini && !hasGeminiKey) {
  console.error(
    'Missing GEMINI_API_KEY (or GEMINI_API_KEY_1..10) — needed for Phase 2 and Phase 4'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('═'.repeat(60));
  console.log('  USDA Vietnamese Translation Pipeline');
  console.log('═'.repeat(60));
  console.log(`  Mode: ${dryRun ? '🔍 DRY RUN' : '🚀 LIVE'}`);
  if (phase) console.log(`  Phase: ${phase} only`);
  if (category) console.log(`  Category: ${category}`);
  if (resume) console.log(`  Resume: from checkpoints`);
  console.log('');

  const startTime = Date.now();
  let updatedIds: string[] = [];

  // Restore Phase 3 → Phase 4 handoff from checkpoint on resume
  if (resume) {
    const cp3 = loadCheckpoint<{ updatedIds?: string[] }>(
      'checkpoint-3-ids.json'
    );
    if (cp3.updatedIds && cp3.updatedIds.length > 0) {
      updatedIds = cp3.updatedIds;
      console.log(`  Restored ${updatedIds.length} updatedIds from checkpoint`);
    }
  }

  try {
    // Phase 1: Google Translate
    if (!phase || phase === 1) {
      await runPhase1({ dryRun, category });
    }

    // Phase 2: Gemini Flash name_alt
    if (!phase || phase === 2) {
      await runPhase2({ dryRun, category });
    }

    // Phase 3: DB Update
    if (!phase || phase === 3) {
      updatedIds = await runPhase3({ dryRun, category });
      // Persist for --resume handoff to Phase 4
      if (updatedIds.length > 0) {
        saveCheckpoint('checkpoint-3-ids.json', { updatedIds });
      }
    }

    // Phase 4: Re-embed
    if (!phase || phase === 4) {
      await runPhase4({ dryRun, updatedIds });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ✅ Pipeline complete in ${elapsed}s`);
    console.log('═'.repeat(60));
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.error(`\n${'═'.repeat(60)}`);
    console.error(`  ❌ Pipeline failed after ${elapsed}s`);
    console.error(`  Checkpoints preserved — rerun with --resume to continue`);
    console.error('═'.repeat(60));
    console.error(err);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
