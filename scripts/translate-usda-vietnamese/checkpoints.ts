/**
 * Checkpoint file management for resume-safe pipeline execution.
 *
 * Files stored in data/translation-checkpoints/:
 *   checkpoint-1.json — { [id]: { name_primary_vi: string } }
 *   checkpoint-2.json — { [id]: { name_alt: string[] } }
 *   checkpoint-4.json — { [id]: { hash: string } }
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CHECKPOINT_DIR = resolve(
  import.meta.dirname,
  '../../data/translation-checkpoints'
);

function ensureDir() {
  if (!existsSync(CHECKPOINT_DIR)) {
    mkdirSync(CHECKPOINT_DIR, { recursive: true });
  }
}

function filePath(name: string): string {
  return resolve(CHECKPOINT_DIR, name);
}

export function loadCheckpoint<T extends Record<string, unknown>>(
  name: string
): T {
  const fp = filePath(name);
  if (existsSync(fp)) {
    try {
      return JSON.parse(readFileSync(fp, 'utf-8')) as T;
    } catch {
      console.warn(`  ⚠ Corrupt checkpoint ${name}, starting fresh`);
    }
  }
  return {} as T;
}

export function saveCheckpoint<T extends Record<string, unknown>>(
  name: string,
  data: T
): void {
  ensureDir();
  writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf-8');
}

/** Merge new entries into an existing checkpoint and save. */
export function mergeAndSave<T extends Record<string, unknown>>(
  name: string,
  existing: T,
  newEntries: Record<string, unknown>
): T {
  const merged = { ...existing, ...newEntries } as T;
  saveCheckpoint(name, merged);
  return merged;
}
