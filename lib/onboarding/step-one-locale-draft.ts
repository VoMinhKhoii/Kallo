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

export function writeStepOneLocaleDraft(value: StepOneLocaleDraft) {
  const storage = getSessionStorage();
  if (!storage) return;

  storage.setItem(KEY, JSON.stringify(value));
}

export function readStepOneLocaleDraft(): StepOneLocaleDraft | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  const raw = storage.getItem(KEY);
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
      storage.removeItem(KEY);
      return null;
    }

    return {
      countryOfOrigin: parsed.countryOfOrigin ?? null,
      countryOfResidence: parsed.countryOfResidence ?? null,
      preferredLocale: parsed.preferredLocale,
    };
  } catch {
    storage.removeItem(KEY);
    return null;
  }
}

export function clearStepOneLocaleDraft() {
  const storage = getSessionStorage();
  if (!storage) return;

  storage.removeItem(KEY);
}
