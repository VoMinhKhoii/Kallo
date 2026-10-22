/**
 * The look every web dialog shares — the card, the Lora title and the muted
 * line under it — so a change here reaches the form dialogs
 * (`ResponsiveModal`: Log weight, Share meal, Add friend) and every confirm
 * (`ConfirmDialog`) at once. Only the look is shared: a confirm stays a Radix
 * AlertDialog (no outside-click close, announced as an alert) and a form stays
 * a Dialog that becomes a bottom sheet on phones.
 *
 * Classes, not components, because the two Radix families have their own
 * Content/Title/Description parts; each caller adds only its own layout.
 */
export const dialogShell = {
  card: 'rounded-2xl border-kallo-border/60 bg-card text-kallo-text',
  title: 'font-medium font-serif text-[22px] text-kallo-text leading-snug',
  description: 'font-sans-display text-[13px] text-kallo-text-muted',
} as const;
