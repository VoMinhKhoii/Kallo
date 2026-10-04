/**
 * Below Tailwind's `md` (48rem = 768px) — where the app's mobile shell (header,
 * tab bar, bottom sheets) takes over. `767.98px`, not `767px`: under browser
 * zoom or device scaling the viewport can be fractional, and a 767.5px window
 * must still be a phone here because `md:` has not switched on yet either.
 */
export const MOBILE_QUERY = '(max-width: 767.98px)';
