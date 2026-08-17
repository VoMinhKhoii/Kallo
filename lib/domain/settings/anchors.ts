/**
 * Single source of truth for settings anchor ids. The four top-level values
 * back the anchor nav; SUBSECTION_ANCHOR ids stay as in-group scroll targets so
 * validation errors can still jump to the exact subsection.
 *
 * In `lib/` because three layers agree on these strings — the page renders
 * them as element ids, the nav scrolls to them, and `useProfileForm` jumps to
 * the subsection holding the first invalid field. `lib/` is the only layer all
 * three may import.
 */
export const PROFILE_ANCHOR = 'settings-profile';
export const PREFERENCES_ANCHOR = 'settings-preferences';
export const SUBSCRIPTION_ANCHOR = 'settings-subscription';
export const FEEDBACK_ANCHOR = 'settings-feedback';
export const ACCOUNT_ANCHOR = 'settings-account';

export const SUBSECTION_ANCHOR = {
  'body-metrics': 'settings-body-metrics',
  regional: 'settings-regional',
  cooking: 'settings-cooking',
  sharing: 'settings-sharing',
} as const;
