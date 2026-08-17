// Draft persistence and sizing helpers for the composer textarea, extracted
// from meal-input.tsx so that component stays about rendering. Browser-only by
// behaviour (localStorage), but safe to call during SSR: every access is
// guarded and degrades to the empty draft.
//
// Storage keys are VERSIONED. A shape change gets a new key plus an entry in
// the legacy list, so an old payload is deleted rather than parsed into a
// half-valid row.
import {
  createEmptyRow,
  type ManualMealRow,
} from '@/lib/domain/logging/manual-logging';

const STORAGE_KEY = 'nham:meal-input-draft';
// v3: rows are {id, query, ingredient, grams} — `query` is the raw typed text.
// Older shapes (v2 {id, ingredient, grams}, pre-rework {id, qty, name}) are
// incompatible and their keys are deleted on first read.
const MANUAL_ROWS_KEY = 'nham:meal-input-manual-items-v3';
const LEGACY_MANUAL_ITEMS_KEYS = [
  'nham:meal-input-manual-items',
  'nham:meal-input-manual-items-v2',
];

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

export function readDraft(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeDraft(text: string) {
  try {
    if (text) {
      localStorage.setItem(STORAGE_KEY, text);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable (incognito, quota exceeded)
  }
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

export function readManualRowsDraft(): ManualMealRow[] {
  try {
    for (const key of LEGACY_MANUAL_ITEMS_KEYS) localStorage.removeItem(key);
    const raw = localStorage.getItem(MANUAL_ROWS_KEY);
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

export function writeManualRowsDraft(rows: ManualMealRow[]) {
  try {
    const filled = rows.filter(
      (row) => row.ingredient || row.query.trim() || row.grams.trim()
    );
    if (filled.length === 0) {
      localStorage.removeItem(MANUAL_ROWS_KEY);
    } else {
      localStorage.setItem(MANUAL_ROWS_KEY, JSON.stringify(rows));
    }
  } catch {}
}
