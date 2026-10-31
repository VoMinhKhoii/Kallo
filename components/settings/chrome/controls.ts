/**
 * The control styles every settings page shares, so a row reads the same on
 * any page: 36px fields and 32px buttons with 8px corners — never pills.
 */

/** A text or number field. */
export const FIELD_CLASS =
  'h-9 w-full rounded-lg border border-kallo-border bg-card px-3 text-[14px] text-kallo-text outline-none transition-colors placeholder:text-kallo-text-muted hover:border-kallo-accent/50 focus:border-kallo-accent focus-visible:ring-2 focus-visible:ring-kallo-accent/40';

/** A row's secondary action (Export, Sign out, Connect, Change photo). */
export const SECONDARY_BUTTON =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-kallo-border bg-card px-3 font-medium text-[13px] text-kallo-text transition-colors duration-150 hover:bg-kallo-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent disabled:opacity-60';

/** A quieter action beside a secondary one (Remove, Disconnect, Cancel). */
export const GHOST_BUTTON =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 font-medium text-[13px] text-kallo-text-muted transition-colors duration-150 hover:bg-kallo-hover hover:text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent disabled:opacity-40';

/**
 * The one destructive action (Delete account), in conventional error red:
 * terracotta reads as a style, not a warning.
 */
export const DANGER_BUTTON =
  'inline-flex h-8 shrink-0 items-center rounded-lg bg-kallo-error px-3 font-medium text-[13px] text-white transition-colors duration-150 hover:bg-kallo-error/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-error/40 disabled:opacity-40';
