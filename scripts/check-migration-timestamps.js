#!/usr/bin/env node
/**
 * Migration Timestamp Validator
 *
 * Validates all Supabase migration files for:
 *   1. Correct filename format: YYYYMMDDHHMMSS_description.sql
 *   2. Strict chronological ordering (no duplicates, no out-of-order)
 *   3. No future-dated timestamps (filename digits are UTC, matching the
 *      Supabase CLI, which stamps `supabase migration new` files in UTC)
 *   4. In PR context (GITHUB_BASE_REF set): every migration the branch ADDS
 *      must sort AFTER every migration already on the base branch. Staging/
 *      prod deploys apply the base branch's migrations continuously, so a
 *      new file that sorts before the base's newest would be refused or
 *      skipped by `supabase db push` (run without --include-all) AFTER
 *      merge — a failure mode invisible to fresh-database validation.
 *      (Checks 1-3 sort the directory first, so they can never catch this:
 *      a sorted set is always "in order"; the conflict is only relative to
 *      what is already applied remotely.)
 *
 * Exit codes:
 *   0 - All migrations valid
 *   1 - One or more errors found
 */

const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = 'supabase/migrations';
// GMT+7 offset in milliseconds
const GMT7_MS = 7 * 60 * 60 * 1000;

/**
 * Parse YYYYMMDDHHMMSS string as a UTC instant → Date.
 * The Supabase CLI stamps migration filenames in UTC, so the digits are
 * interpreted as UTC (not GMT+7 wall-clock). Returns null if invalid.
 */
function parseTimestamp(ts) {
  if (!/^\d{14}$/.test(ts)) return null;
  const year = parseInt(ts.slice(0, 4), 10);
  const month = parseInt(ts.slice(4, 6), 10) - 1;
  const day = parseInt(ts.slice(6, 8), 10);
  const hour = parseInt(ts.slice(8, 10), 10);
  const min = parseInt(ts.slice(10, 12), 10);
  const sec = parseInt(ts.slice(12, 14), 10);
  // Filename digits are already UTC — do not shift by the GMT+7 offset.
  const utcMs = Date.UTC(year, month, day, hour, min, sec);
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  // Date.UTC normalizes impossible dates (e.g. 20250231 → March 3), so
  // round-trip the components and reject anything that didn't survive.
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month ||
    d.getUTCDate() !== day ||
    d.getUTCHours() !== hour ||
    d.getUTCMinutes() !== min ||
    d.getUTCSeconds() !== sec
  ) {
    return null;
  }
  return d;
}

function extractTimestamp(filename) {
  const m = filename.match(/^(\d{14})_.+\.sql$/);
  return m ? m[1] : null;
}

function fmt(date) {
  const utc = date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC');
  const gmt7str = new Date(date.getTime() + GMT7_MS)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' GMT+7');
  return `${utc} (${gmt7str})`;
}

function main() {
  const dir = path.join(process.cwd(), MIGRATIONS_DIR);

  if (!fs.existsSync(dir)) {
    console.error(`ERROR: Migration directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    process.exit(0);
  }

  const now = new Date();
  console.log(`Checking ${files.length} migration(s)...`);
  console.log(`Current time: ${fmt(now)}\n`);

  let errors = 0;
  let prevTs = '';
  let prevFile = '';

  for (const filename of files) {
    const ts = extractTimestamp(filename);

    // 1. Format validation
    if (!ts) {
      console.error(
        `ERROR: Invalid filename format — ${filename}\n  Expected: YYYYMMDDHHMMSS_description.sql`
      );
      errors++;
      continue;
    }

    const date = parseTimestamp(ts);
    if (!date) {
      console.error(`ERROR: Unparseable timestamp ${ts} in ${filename}`);
      errors++;
      continue;
    }

    // 2. Ordering check
    if (prevTs) {
      if (ts === prevTs) {
        console.error(`ERROR: Duplicate timestamp ${ts}`);
        console.error(`  - ${prevFile}`);
        console.error(`  - ${filename}`);
        errors++;
      } else if (ts < prevTs) {
        console.error(`ERROR: Out-of-order timestamp`);
        console.error(`  - ${prevFile} (${prevTs})`);
        console.error(`  - ${filename} (${ts}) ← should be after ${prevTs}`);
        errors++;
      }
    }

    // 3. Future timestamp check (UTC)
    if (date > now) {
      console.error(`ERROR: Future-dated migration — ${filename}`);
      console.error(`  Timestamp: ${ts}`);
      console.error(`  Parsed as: ${fmt(date)}`);
      console.error(`  Now:       ${fmt(now)}`);
      errors++;
    }

    prevTs = ts;
    prevFile = filename;
  }

  // 4. PR-context check: new migrations must sort after the base branch's
  // newest migration (proxy for "after everything already applied remotely").
  const baseRef = process.env.GITHUB_BASE_REF;
  if (baseRef) {
    const { execSync } = require('node:child_process');
    let baseFiles = [];
    try {
      baseFiles = execSync(
        `git ls-tree -r --name-only "origin/${baseRef}" -- ${MIGRATIONS_DIR}`,
        { encoding: 'utf8' }
      )
        .split('\n')
        .map((f) => path.basename(f.trim()))
        .filter((f) => f.endsWith('.sql'));
    } catch (err) {
      console.error(
        `WARNING: could not list migrations on origin/${baseRef} — skipping base-branch ordering check.`,
        err.message
      );
    }
    if (baseFiles.length > 0) {
      const baseSet = new Set(baseFiles);
      const baseMax = baseFiles
        .map((f) => extractTimestamp(f))
        .filter(Boolean)
        .sort()
        .pop();
      const added = files.filter((f) => !baseSet.has(f));
      for (const filename of added) {
        const ts = extractTimestamp(filename);
        if (ts && baseMax && ts <= baseMax) {
          console.error(
            `ERROR: New migration sorts before the base branch's newest migration — ${filename}`
          );
          console.error(`  New file timestamp:      ${ts}`);
          console.error(`  Newest on ${baseRef}:    ${baseMax}`);
          console.error(
            '  Deploys apply base-branch migrations continuously, so after merge'
          );
          console.error(
            '  `supabase db push` would refuse or skip this file as out-of-order.'
          );
          console.error(
            '  Fix: regenerate/rename it with a current timestamp (> the base max).'
          );
          errors++;
        }
      }
      if (added.length > 0 && errors === 0) {
        console.log(
          `Base-branch ordering OK: ${added.length} new migration(s) all sort after ${baseMax} (origin/${baseRef}).`
        );
      }
    }
  }

  if (errors > 0) {
    console.error(
      `\nFAILED: ${errors} error(s) found in migration timestamps.`
    );
    process.exit(1);
  }

  console.log(
    `OK: ${files.length} migrations — valid format, ordered, no future timestamps.`
  );
}

main();
