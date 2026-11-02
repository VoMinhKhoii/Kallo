/** Account-scoped storage shared by text, manual rows and staged relog picks. */
const PREFIX = 'nham:meal-input-';
const KEYS = {
  text: `${PREFIX}draft`,
  manual: `${PREFIX}manual-items-v3`,
  staged: `${PREFIX}relog-staged-v1`,
};
type DraftKind = keyof typeof KEYS;

let legacyCleared = false;
// Never reset in this document: pending timers and beforeunload closures still
// own the departing account's state. Account exits hard-navigate to a new one.
let exiting = false;

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  const store = window.localStorage;
  if (!legacyCleared) {
    const legacy = [
      ...Object.values(KEYS),
      `${PREFIX}manual-items`,
      `${PREFIX}manual-items-v2`,
    ];
    for (const key of legacy) store.removeItem(key);
    legacyCleared = true;
  }
  return store;
}

export function readComposerDraft(
  kind: DraftKind,
  userId: string
): string | null {
  if (exiting || !userId) return null;
  try {
    return storage()?.getItem(`${KEYS[kind]}:${userId}`) ?? null;
  } catch {
    return null;
  }
}

export function writeComposerDraft(
  kind: DraftKind,
  userId: string,
  value: string | null
): void {
  if (exiting || !userId) return;
  try {
    const store = storage();
    const key = `${KEYS[kind]}:${userId}`;
    if (value === null) store?.removeItem(key);
    else store?.setItem(key, value);
  } catch {
    // Disabled storage or quota exceeded: the in-memory composer still works.
  }
}

/** Purge all accounts and versions, then suppress exit-navigation flushes. */
export function clearComposerDrafts(): void {
  exiting = true;
  try {
    const store = storage();
    if (!store) return;
    for (let index = store.length - 1; index >= 0; index--) {
      const key = store.key(index);
      if (key?.startsWith(PREFIX)) store.removeItem(key);
    }
  } catch {
    // The write barrier still applies when storage is unavailable.
  }
}
