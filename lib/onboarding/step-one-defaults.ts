import { defaultLocale, type Locale, locales } from '@/i18n/config';
import type { StepOneLocaleDraft } from './step-one-locale-draft';

interface BuildStepOneDefaultsArgs {
  activeLocale?: string | null;
  countryOfOrigin?: string | null;
  countryOfResidence?: string | null;
  draft?: StepOneLocaleDraft | null;
  profilePreferredLocale?: string | null;
}

function toSupportedLocale(value?: string | null): Locale | null {
  if (!value || !locales.includes(value as Locale)) {
    return null;
  }

  return value as Locale;
}

export function buildStepOneDefaults({
  activeLocale,
  countryOfOrigin,
  countryOfResidence,
  draft,
  profilePreferredLocale,
}: BuildStepOneDefaultsArgs): StepOneLocaleDraft {
  return {
    countryOfOrigin:
      draft?.countryOfOrigin !== undefined
        ? draft.countryOfOrigin
        : (countryOfOrigin ?? null),
    countryOfResidence:
      draft?.countryOfResidence !== undefined
        ? draft.countryOfResidence
        : (countryOfResidence ?? null),
    preferredLocale:
      draft?.preferredLocale ??
      toSupportedLocale(activeLocale) ??
      toSupportedLocale(profilePreferredLocale) ??
      defaultLocale,
  };
}
