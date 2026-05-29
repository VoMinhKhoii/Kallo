/**
 * The Nhẩm design system, transcribed from the web's `app/globals.css` `:root`
 * tokens (the canonical `--nham-*` values) and the `nham-design` skill. This is
 * the single source of truth for the native app's look, so mobile stays
 * visually consistent with web. Visual direction: "Apple Notes on cream paper."
 */

export const colors = {
  surface: '#fefbf6', // app background — paper cream
  elev: '#ffffff', // cards / sheets
  text: '#2c2416', // espresso
  textMuted: '#8b7355', // warm taupe
  textSoft: '#6b5d4f',
  accent: '#c9a87c', // signature tan — highlights, italic accent
  accentDark: '#b89968',
  border: '#e8d5b5', // biscotti hairline
  borderSoft: 'rgba(232, 213, 181, 0.6)',
  hover: '#f0eae0',
  track: '#f5f4f0',
  stone: '#a8a29e', // cool gray — captions, fat macro
  btn: '#695e4e', // solid CTA — warm umber (NOT black)
  btnHover: '#5a5043',
  // Macros are part of the palette, not a separate one.
  macroProtein: '#c9a87c',
  macroCarbs: '#8b7355',
  macroFat: '#a8a29e',
  // Status — warm, never pure red/green.
  success: '#7ca368', // sage
  danger: '#d37b69', // terracotta
  // Adherence heatmap diverging scale.
  heatmap: {
    onTarget: '#7ca368',
    close: '#a6c495',
    slight: '#d4c9ad',
    moderate: '#e09c84',
    far: '#d37b69',
    barMiss: '#d4c9ad',
  },
} as const;

/**
 * Font family names. These match the keys registered with `useFonts`
 * (see theme/fonts.ts). Lora = display/serif (headings, numbers > 18px, meal
 * quotes — never bold). DM Sans = UI/body (buttons, labels, tabular numbers).
 */
export const fonts = {
  serifRegular: 'Lora_400Regular',
  serifMedium: 'Lora_500Medium',
  serifSemiBold: 'Lora_600SemiBold',
  serifItalic: 'Lora_400Regular_Italic',
  sansRegular: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemiBold: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
} as const;

export const fontSize = {
  display: 48,
  h1: 40,
  h2: 32,
  h3: 24,
  h4: 20,
  lg: 18,
  md: 16,
  sm: 14,
  xs: 12,
  '2xs': 11,
  eyebrow: 10,
} as const;

// Multipliers (RN needs absolute lineHeight; the Text primitive multiplies).
export const leading = {
  display: 1.1,
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.65,
} as const;

// RN letterSpacing is in points (web em values converted at the target size).
export const tracking = {
  eyebrow: 2, // ~0.2em @ 10px
  wide: 0.6,
  tight: -0.3,
  display: -1.4,
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  '2xl': 18,
  '3xl': 22,
  '4xl': 26,
  pill: 9999,
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

// Warm, espresso-tinted, very low-contrast shadows (never #000-based).
export const shadow = {
  xs: {
    shadowColor: '#2c2416',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sm: {
    shadowColor: '#2c2416',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#2c2416',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
} as const;

export const theme = {
  colors,
  fonts,
  fontSize,
  leading,
  tracking,
  radii,
  space,
  shadow,
} as const;

export type Theme = typeof theme;
