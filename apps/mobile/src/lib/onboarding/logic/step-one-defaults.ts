/**
 * Mobile adaptation of web `lib/onboarding/step-one-defaults.ts`. The web's
 * sessionStorage locale-draft dance (for the mid-wizard locale switch that
 * remounts the app) is dropped — mobile keeps in-memory wizard state and does
 * not live-switch the app locale, so there's no remount to survive.
 */
import type { AppLocale } from '~/i18n';

const LOCALES: readonly AppLocale[] = ['en', 'vi'];
const DEFAULT_LOCALE: AppLocale = 'en';

export interface StepOneData {
  countryOfOrigin: string | null;
  countryOfResidence: string | null;
  preferredLocale: AppLocale;
}

function toSupportedLocale(value?: string | null): AppLocale | null {
  if (!value || !LOCALES.includes(value as AppLocale)) return null;
  return value as AppLocale;
}

export function buildStepOneDefaults({
  activeLocale,
  countryOfOrigin,
  countryOfResidence,
  profilePreferredLocale,
}: {
  activeLocale?: string | null;
  countryOfOrigin?: string | null;
  countryOfResidence?: string | null;
  profilePreferredLocale?: string | null;
}): StepOneData {
  return {
    countryOfOrigin: countryOfOrigin ?? null,
    countryOfResidence: countryOfResidence ?? null,
    preferredLocale:
      toSupportedLocale(activeLocale) ??
      toSupportedLocale(profilePreferredLocale) ??
      DEFAULT_LOCALE,
  };
}
