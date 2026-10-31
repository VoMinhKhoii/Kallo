/**
 * The control styles every settings page shares, so a row reads the same on
 * any page: 36px fields and 32px buttons with 8px corners — never pills.
 */

/** A text or number field. */
export const FIELD_CLASS =
  'h-9 w-full rounded-lg border border-kallo-border bg-card px-3 text-[14px] text-kallo-text outline-none transition-colors placeholder:text-kallo-text-muted hover:border-kallo-accent/50 focus:border-kallo-accent focus-visible:ring-2 focus-visible:ring-kallo-accent/40';

/**
 * The page's one filled action (Save, Send feedback, Start setup), in the
 * umber primary. A row-sized one (Upgrade) narrows it to h-8 / 13px.
 */
export const PRIMARY_BUTTON =
  'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-kallo-btn px-4 font-medium text-[14px] text-kallo-btn-ink transition-colors duration-150 hover:bg-kallo-btn/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/60 disabled:opacity-50';

/** A row's secondary action (Export, Sign out, Connect, Change photo). */
export const SECONDARY_BUTTON =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-kallo-border bg-card px-3 font-medium text-[13px] text-kallo-text transition-colors duration-150 hover:bg-kallo-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent disabled:opacity-60';

/** A quieter action beside a secondary one (Remove, Disconnect, Cancel). */
export const GHOST_BUTTON =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 font-medium text-[13px] text-kallo-text-muted transition-colors duration-150 hover:bg-kallo-hover hover:text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent disabled:opacity-40';

/**
 * A destructive action (Delete account, Cancel plan), in conventional error red:
 * terracotta reads as a style, not a warning.
 */
export const DANGER_BUTTON =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-kallo-error-fill px-3 font-medium text-[13px] text-white transition-colors duration-150 hover:bg-kallo-error-fill/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-error/40 disabled:opacity-40';
