// localStorage persistence for the relog staged list, mirroring how the
// composer's manual rows already survive a reload. Browser-only by behaviour;
// every access is guarded and degrades to an empty list.
//
// The key is VERSIONED: a shape change gets a new key so an old payload is
// dropped rather than parsed into a half-valid entry.
import {
  readComposerDraft,
  writeComposerDraft,
} from '@/lib/domain/logging/drafts/composer-drafts';
import type { RelogStagedEntry } from '@/lib/domain/logging/relog/relog';

function isValidRef(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const ref = value as Record<string, unknown>;
  if (typeof ref.sourceMealId !== 'string') return false;
  if (ref.kind === 'meal') return true;
  return ref.kind === 'dish' && typeof ref.mealItemOrder === 'number';
}

function isValidEntry(value: unknown): value is RelogStagedEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.stageId === 'string' &&
    typeof entry.label === 'string' &&
    typeof entry.partCount === 'number' &&
    typeof entry.summary === 'object' &&
    entry.summary !== null &&
    isValidRef(entry.ref)
  );
}

export function readStagedDraft(userId: string): RelogStagedEntry[] {
  try {
    const raw = readComposerDraft('staged', userId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // All-or-nothing: a partially valid list would stage something the user
    // never picked.
    if (Array.isArray(parsed) && parsed.every(isValidEntry)) return parsed;
  } catch {
    // Unparseable or unavailable — fall through to the empty list.
  }
  return [];
}

export function writeStagedDraft(entries: RelogStagedEntry[], userId: string) {
  try {
    if (entries.length === 0) {
      writeComposerDraft('staged', userId, null);
    } else {
      writeComposerDraft('staged', userId, JSON.stringify(entries));
    }
  } catch {
    // localStorage unavailable (incognito, quota exceeded)
  }
}
