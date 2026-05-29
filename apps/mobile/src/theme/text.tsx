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
  | 'italicAccent';

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
});

export function Text({
  variant = 'body',
  style,
  ...props
}: TextProps & { variant?: TextVariant }) {
  return <RNText style={[styles[variant], style]} {...props} />;
}
