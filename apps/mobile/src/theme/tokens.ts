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
  borderSoft: 'rgba(232, 213, 181, 0.6)', // biscotti @ 60%
  borderHalf: 'rgba(232, 213, 181, 0.5)', // biscotti @ 50% — totals-row dashed top border
  borderFaint: 'rgba(232, 213, 181, 0.3)', // biscotti @ 30% — faint hairlines
  borderBiscotti40: 'rgba(232, 213, 181, 0.4)', // biscotti @ 40% — input resting border
  elevTranslucent: 'rgba(255, 255, 255, 0.8)', // card/elev @ 80%
  surface80: 'rgba(254, 251, 246, 0.8)', // surface cream @ 80%
  accentSelectedFill: 'rgba(201, 168, 124, 0.1)', // accent @ 10% — selected-state fill
  accentSelectedBorder: 'rgba(201, 168, 124, 0.5)', // accent @ 50% — selected-state border
  borderAccent40: 'rgba(201, 168, 124, 0.4)', // accent @ 40% — input focus-within border
  timelineDotFill: 'rgba(201, 168, 124, 0.3)', // accent @ 30% — pulsing timeline dot fill
  btnBorderGhost: 'rgba(105, 94, 78, 0.4)', // btn umber @ 40% — ghost button border
  textMuted60: 'rgba(139, 115, 85, 0.6)', // textMuted @ 60%
  textMuted70: 'rgba(139, 115, 85, 0.7)', // textMuted @ 70% — macro-bar labels
  placeholderMuted40: 'rgba(139, 115, 85, 0.4)', // textMuted @ 40% — input placeholder
  // Numeric alpha set for the nutrition tree (web `accent/NN`, `hover/NN`, etc.
  // that RN can't express via Tailwind opacity). One predictable convention.
  accent10: 'rgba(201, 168, 124, 0.1)', // == accentSelectedFill
  accent15: 'rgba(201, 168, 124, 0.15)',
  accent30: 'rgba(201, 168, 124, 0.3)', // == timelineDotFill
  accent35: 'rgba(201, 168, 124, 0.35)',
  accent40: 'rgba(201, 168, 124, 0.4)', // == borderAccent40
  accent50: 'rgba(201, 168, 124, 0.5)', // == accentSelectedBorder
  accent60: 'rgba(201, 168, 124, 0.6)',
  hover40: 'rgba(240, 234, 224, 0.4)',
  hover50: 'rgba(240, 234, 224, 0.5)',
  stone50: 'rgba(168, 162, 158, 0.5)',
  stone70: 'rgba(168, 162, 158, 0.7)',
  text40: 'rgba(44, 36, 22, 0.4)',
  textMuted50: 'rgba(139, 115, 85, 0.5)',
  danger70: 'rgba(211, 123, 105, 0.7)',
  // Settings + onboarding neutral/cream palette. The web hardcodes these hexes;
  // they diverge slightly from the core --nham-* tokens (lighter hairlines,
  // a parallel warm-gray text ramp, near-white cream fills).
  inputBorder: '#eae7e0', // light input/divider hairline (≠ border #e8d5b5)
  inputBorder40: 'rgba(234, 231, 224, 0.4)', // tab-list / segmented control bg
  textWarm: '#7b6f62', // warm secondary text (≠ textSoft #6b5d4f, textMuted)
  textHelp: '#8b8682', // cool help-text gray (onboarding)
  textSelected: '#6f6556', // selected-state label gray
  cream: '#fdfcf8', // raised card / button-label cream (≠ surface #fefbf6)
  cream95: 'rgba(253, 252, 248, 0.95)', // pinned save bar
  cardCream: '#fffcf8', // card cream (onboarding)
  selectedCard: '#fff8ef', // selected option-card fill (onboarding)
  selectedSegment: '#fbf2e6', // selected segment fill (onboarding)
  btnDarkHover: '#1c1917', // dark primary-button hover (settings)
  btnDarkHover2: '#3d3425', // dark primary-button hover (onboarding/light)
  accent05: 'rgba(201, 168, 124, 0.05)', // carb-split selected card fill
  accent07: 'rgba(201, 168, 124, 0.07)', // hero target gradient
  accent20: 'rgba(201, 168, 124, 0.2)', // hero divider border
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
  '13': 13, // detail rows (item name/calories, totals label) — between sm(14) and 2xs(11)
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
  buttonXl: 12, // web rounded-xl (12px) — sits between lg(10) and xl(14)
  containerLg: 16, // web rounded-2xl (16px) — for components whose container differs from the shared 2xl(18)
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
  // Warm accent-tinted (#c9a87c) input glow — NOT espresso. Resting + focus.
  input: {
    shadowColor: '#c9a87c',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  inputFocus: {
    shadowColor: '#c9a87c',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
