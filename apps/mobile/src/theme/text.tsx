import { Text as RNText, type TextProps, StyleSheet } from 'react-native';
import { colors, fonts, fontSize, leading, tracking } from './tokens';

export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'lead'
  | 'body'
  | 'small'
  | 'meta'
  | 'eyebrow'
  | 'mealQuote'
  | 'numDisplay'
  | 'numInline'
  | 'italicAccent'
  | 'chipText'
  | 'numCaption'
  | 'macroLabel'
  | 'macroValue'
  | 'itemMacro'
  | 'macroTiny'
  | 'macroInline'
  | 'itemName'
  | 'itemCalories'
  | 'calorieBold'
  | 'pillLabel'
  | 'timeLabel'
  | 'phaseLabel'
  | 'captionTabular'
  | 'numStrong';

const r = Math.round;

/**
 * Type system from the design tokens. Lora (serif) for display/headings/numbers
 * and meal quotes — never bold; DM Sans (sans) for everything else. The
 * signature `italicAccent` is Lora italic in tan. Numbers are tabular.
 */
const styles = StyleSheet.create({
  display: {
    fontFamily: fonts.serifSemiBold,
    fontSize: fontSize.display,
    lineHeight: r(fontSize.display * leading.display),
    letterSpacing: tracking.display,
    color: colors.text,
  },
  h1: {
    fontFamily: fonts.serifRegular,
    fontSize: fontSize.h1,
    lineHeight: r(fontSize.h1 * leading.tight),
    letterSpacing: tracking.tight,
    color: colors.text,
  },
  h2: {
    fontFamily: fonts.serifRegular,
    fontSize: fontSize.h2,
    lineHeight: r(fontSize.h2 * leading.tight),
    letterSpacing: tracking.tight,
    color: colors.text,
  },
  h3: {
    fontFamily: fonts.serifRegular,
    fontSize: fontSize.h3,
    lineHeight: r(fontSize.h3 * leading.tight),
    color: colors.text,
  },
  h4: {
    fontFamily: fonts.serifRegular,
    fontSize: fontSize.h4,
    lineHeight: r(fontSize.h4 * leading.snug),
    color: colors.text,
  },
  lead: {
    fontFamily: fonts.sansRegular,
    fontSize: fontSize.lg,
    lineHeight: r(fontSize.lg * leading.relaxed),
    color: colors.textMuted,
  },
  body: {
    fontFamily: fonts.sansRegular,
    fontSize: fontSize.md,
    lineHeight: r(fontSize.md * leading.relaxed),
    color: colors.text,
  },
  small: {
    fontFamily: fonts.sansRegular,
    fontSize: fontSize.sm,
    lineHeight: r(fontSize.sm * leading.normal),
    color: colors.textMuted,
  },
  meta: {
    fontFamily: fonts.sansRegular,
    fontSize: fontSize['2xs'],
    lineHeight: r(fontSize['2xs'] * leading.normal),
    color: colors.stone,
  },
  eyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.eyebrow,
    letterSpacing: tracking.eyebrow,
    textTransform: 'uppercase',
    color: colors.stone,
  },
  mealQuote: {
    fontFamily: fonts.serifRegular,
    fontSize: fontSize.lg,
    lineHeight: r(fontSize.lg * leading.relaxed),
    color: colors.text,
  },
  numDisplay: {
    fontFamily: fonts.serifSemiBold,
    fontSize: fontSize.h2,
    letterSpacing: tracking.display,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  numInline: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.md,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  italicAccent: {
    fontFamily: fonts.serifItalic,
    fontSize: fontSize.lg,
    lineHeight: r(fontSize.lg * leading.relaxed),
    color: colors.accent,
  },
  // 12px (fontSize.xs) medium-weight pill/caption — fills the unused xs step.
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  // '{calories} / {target} kcal' line under the ring (web: semibold xs tabular).
  numCaption: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  // Macro-bar labels (web: bold 10px uppercase tracking-wider, muted).
  macroLabel: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.eyebrow,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  // Macro-bar values '38/120g' (web: 11px tabular muted, right-aligned).
  macroValue: {
    fontFamily: fonts.sansRegular,
    fontSize: fontSize['2xs'],
    color: colors.textMuted,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  // Per-item 'P:38g' shorthand — 10px muted tabular, no uppercase/tracking.
  // itemMacro / macroTiny / macroInline are identical aliases (P/C/F spans).
  itemMacro: {
    fontFamily: fonts.sansRegular,
    fontSize: fontSize.eyebrow,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  macroTiny: {
    fontFamily: fonts.sansRegular,
    fontSize: fontSize.eyebrow,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  macroInline: {
    fontFamily: fonts.sansRegular,
    fontSize: fontSize.eyebrow,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  // Item/dish row name — DM Sans medium 13px (off the named scale → fontSize['13']).
  itemName: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSize['13'],
    color: colors.text,
  },
  // Per-item bold calorie figure — DM Sans bold 13px tabular.
  // calorieBold is an identical alias for the bold per-row calorie value.
  itemCalories: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize['13'],
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  calorieBold: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize['13'],
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  // Edit/Done pill label — DM Sans medium 10px (distinct from bold/uppercase eyebrow).
  pillLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSize.eyebrow,
  },
  // Time label above the card — DM Sans bold 11px, ~1.1pt tracking, muted@60%, no transform.
  timeLabel: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize['2xs'],
    letterSpacing: 1.1,
    color: colors.textMuted60,
  },
  // Bottom-of-card streaming phase label — DM Sans 400 11px muted (distinct from stone meta).
  phaseLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: fontSize['2xs'],
    lineHeight: r(fontSize['2xs'] * leading.normal),
    color: colors.textMuted,
  },
  // Collapsed-summary macro strip + totals-row macro span — 11px muted tabular.
  captionTabular: {
    fontFamily: fonts.sansRegular,
    fontSize: fontSize['2xs'],
    lineHeight: r(fontSize['2xs'] * leading.normal),
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  // Bold tabular calorie value — default 16px; override size inline (14 collapsed, inherit per-item).
  numStrong: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.md,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});

export function Text({
  variant = 'body',
  style,
  ...props
}: TextProps & { variant?: TextVariant }) {
  return <RNText style={[styles[variant], style]} {...props} />;
}
