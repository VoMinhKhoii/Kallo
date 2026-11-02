// Draft persistence and sizing helpers for the composer textarea, extracted
// from meal-input.tsx so that component stays about rendering. Browser-only by
// behaviour (localStorage), but safe to call during SSR: every access is
// guarded and degrades to the empty draft.
//
// Storage keys are VERSIONED. A shape change gets a new key plus an entry in
// the legacy list, so an old payload is deleted rather than parsed into a
// half-valid row.
import {
  readComposerDraft,
  writeComposerDraft,
} from '@/lib/domain/logging/drafts/composer-drafts';
import {
  createEmptyRow,
  type ManualMealRow,
} from '@/lib/domain/logging/manual-logging';

// v3: rows are {id, query, ingredient, grams} — `query` is the raw typed text.
// Older shapes (v2 {id, ingredient, grams}, pre-rework {id, qty, name}) are
// incompatible and their keys are deleted on first read.

export const DRAFT_DEBOUNCE_MS = 500;
// Single-line height matches the submit button (h-8 = 32px) so the placeholder
// sits on the button's vertical centerline. Above MAX, textarea scrolls itself.
const MIN_INPUT_HEIGHT_PX = 32;
const MAX_INPUT_HEIGHT_PX = 200;

export function autoResize(el: HTMLTextAreaElement) {
  el.style.height = '0px';
  const measured = el.scrollHeight;
  const next = Math.max(
    MIN_INPUT_HEIGHT_PX,
    Math.min(measured, MAX_INPUT_HEIGHT_PX)
  );
  el.style.height = `${next}px`;
  el.style.overflowY = measured > MAX_INPUT_HEIGHT_PX ? 'auto' : 'hidden';
}

export const hasMeaningfulText = (text: string) => text.trim().length > 0;

export function readDraft(userId: string): string {
  return readComposerDraft('text', userId) ?? '';
}

export function writeDraft(text: string, userId: string) {
  writeComposerDraft('text', userId, text || null);
}

function isValidManualRow(value: unknown): value is ManualMealRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    typeof row.query !== 'string' ||
    typeof row.grams !== 'string'
  ) {
    return false;
  }
  if (row.ingredient === null) return true;
  if (typeof row.ingredient !== 'object') return false;
  const ingredient = row.ingredient as Record<string, unknown>;
  return (
    typeof ingredient.id === 'string' &&
    typeof ingredient.namePrimary === 'string' &&
    typeof ingredient.per100g === 'object' &&
    ingredient.per100g !== null
  );
}

export function readManualRowsDraft(userId: string): ManualMealRow[] {
  try {
    const raw = readComposerDraft('manual', userId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(isValidManualRow)
      ) {
        return parsed;
      }
    }
  } catch {}
  return [createEmptyRow(crypto.randomUUID())];
}

export function writeManualRowsDraft(rows: ManualMealRow[], userId: string) {
  try {
    const filled = rows.filter(
      (row) => row.ingredient || row.query.trim() || row.grams.trim()
    );
    if (filled.length === 0) {
      writeComposerDraft('manual', userId, null);
    } else {
      writeComposerDraft('manual', userId, JSON.stringify(rows));
    }
  } catch {}
}
