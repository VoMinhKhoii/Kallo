const KEY = 'onboarding-step-1-locale-draft';

export interface StepOneLocaleDraft {
  countryOfOrigin: string | null;
  countryOfResidence: string | null;
  preferredLocale: 'en' | 'vi';
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
}

function clearStoredDraft(storage: Storage) {
  try {
    storage.removeItem(KEY);
  } catch {
    return;
  }
}

export function writeStepOneLocaleDraft(value: StepOneLocaleDraft) {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.setItem(KEY, JSON.stringify(value));
  } catch {
    return;
  }
}

export function readStepOneLocaleDraft(): StepOneLocaleDraft | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(KEY);
  } catch {
    return null;
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StepOneLocaleDraft>;

    if (
      (parsed.preferredLocale !== 'en' && parsed.preferredLocale !== 'vi') ||
      !('countryOfOrigin' in parsed) ||
      !('countryOfResidence' in parsed) ||
      (parsed.countryOfOrigin !== null &&
        typeof parsed.countryOfOrigin !== 'string') ||
      (parsed.countryOfResidence !== null &&
        typeof parsed.countryOfResidence !== 'string')
    ) {
      clearStoredDraft(storage);
      return null;
    }

    return {
      countryOfOrigin: parsed.countryOfOrigin ?? null,
      countryOfResidence: parsed.countryOfResidence ?? null,
      preferredLocale: parsed.preferredLocale,
    };
  } catch {
    clearStoredDraft(storage);
    return null;
  }
}

export function clearStepOneLocaleDraft() {
  const storage = getSessionStorage();
  if (!storage) return;

  clearStoredDraft(storage);
}
