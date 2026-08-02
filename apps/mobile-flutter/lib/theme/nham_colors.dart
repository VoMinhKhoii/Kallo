import 'dart:ui';

/// The Nham design system color palette.
///
/// Transcribed from the web's `globals.css` `:root` tokens (the canonical
/// `--nham-*` values). Visual direction: neutral canvas / ink / hairline with
/// warm interaction washes; tan accent kept for non-text moments only.
///
/// DELIBERATE DIVERGENCE FROM WEB: the canvas is `#F1F1EE`, not the web's
/// `#f9f9f7`. At one step off white every surface in the system — white cards,
/// hairlines, washes — had almost nothing to separate from, and the app read
/// uniformly subtle on a phone. The surfaces tuned against the old canvas moved
/// with it: `track` and `border` both darkened to keep their step below the
/// page, and `pressWash` replaces the warm washes where a control is
/// transparent. Do NOT "resync" these to `globals.css` without re-deciding it.
abstract final class NhamColors {
  // ── Core surfaces ────────────────────────────────────────────────────
  static const Color surface = Color(
    0xFFF1F1EE,
  ); // app background — neutral canvas
  static const Color elev = Color(0xFFFFFFFF); // cards / sheets
  static const Color hover = Color(0xFFF0EAE0); // warm hover/select wash
  // Moved by the SAME delta as [surface] (−8/−8/−9): the canvas↔track step is
  // the whole point of this token, and at the old value it would now sit
  // *lighter* than the page — a track that reads raised instead of recessed.
  static const Color track = Color(0xFFEDECE7); // warm segmented/track
  static const Color track50 = Color(0x80EDECE7); // track @ 50%

  // ── Text ─────────────────────────────────────────────────────────────
  static const Color text = Color(0xFF141413); // near-black ink
  static const Color textMuted = Color(0xFF6E6D66); // neutral muted
  static const Color textSoft = Color(0xFF3D3D3A); // soft long-body text

  // ── Accent ───────────────────────────────────────────────────────────
  static const Color accent = Color(0xFFC9A87C); // signature tan
  static const Color accentDark = Color(0xFFB89968);

  // ── The muted band ───────────────────────────────────────────────────
  // The surface the composer's inline under-logged notice (`PartialDayNotice`)
  // and the relog `/` picker both paint: white copy on muted grey. [textMuted]
  // is the lightest grey that still clears 4.5:1 against white (~5.2:1), which
  // is why the notice picked it.
  static const Color bandSurface = textMuted;
  static const Color bandForeground = Color(0xFFFFFFFF);

  /// Only for GLYPHS on the band, never copy. Text there must stay full white
  /// to hold 4.5:1 against [bandSurface]; an icon carries no text and is not
  /// held to it. Matches the under-logged notice's dismiss glyph.
  static const Color bandForeground70 = Color(0xB3FFFFFF); // white @ 70%

  /// A committed relog pick, rendered inline in the composer as `/Phở bò`.
  ///
  /// The one deliberate blue: a pick is a REFERENCE to stored data, not typed
  /// prose, and the warm palette has no hue that reads "this token is not free
  /// text" without also reading as a warning.
  ///
  /// Darker than the web's `--nham-mention` (#4A90D9) on purpose. That value is
  /// 3.34:1 on the composer's white field — under AA for 14px body text. This
  /// one measures 4.86:1 at the same size, which is the bar every other text
  /// token in this palette is held to.
  static const Color mention = Color(0xFF2B72C6);

  // ── Borders ──────────────────────────────────────────────────────────
  static const Color border = Color(0xFFE2DFD4); // neutral hairline
  static const Color borderSoft = Color(0x99E2DFD4); // hairline @ 60%
  static const Color borderHalf = Color(0x80E2DFD4); // hairline @ 50%
  static const Color borderFaint = Color(0x4DE2DFD4); // hairline @ 30%
  static const Color borderBiscotti40 = Color(0x66E2DFD4); // hairline @ 40%
  static const Color border70 = Color(0xB3E2DFD4); // hairline @ 70%
  static const Color border15 = Color(0x26E2DFD4); // hairline @ 15%

  // ── Translucent surfaces ─────────────────────────────────────────────
  static const Color elevTranslucent = Color(0xCCFFFFFF); // card/elev @ 80%
  static const Color surface80 = Color(0xCCF1F1EE); // canvas @ 80%
  // Scrim ramp (composer dock). These MUST stay the same hue as [surface] —
  // a scrim that fades toward a stale canvas colour is a visible seam, which
  // is the exact thing the ramp exists to remove.
  static const Color surface0 = Color(0x00F1F1EE); // canvas @ 0%
  static const Color surface35 = Color(0x59F1F1EE); // canvas @ 35%
  static const Color surface85 = Color(0xD9F1F1EE); // canvas @ 85%
  static const Color cardWhite55 = Color(0x8CFFFFFF); // card white @ 55%
  static const Color cardWhite40 = Color(0x66FFFFFF); // card white @ 40%
  static const Color cardWhite30 = Color(0x4DFFFFFF); // card white @ 30%

  // ── Accent alpha variants ────────────────────────────────────────────
  static const Color accent05 = Color(0x0DC9A87C); // 5%
  static const Color accent07 = Color(0x12C9A87C); // 7%
  static const Color accent10 = Color(0x1AC9A87C); // 10% — selected fill
  static const Color accent15 = Color(0x26C9A87C); // 15%
  static const Color accent20 = Color(0x33C9A87C); // 20% — hero divider
  static const Color accent30 = Color(0x4DC9A87C); // 30% — timeline dot fill
  static const Color accent35 = Color(0x59C9A87C); // 35%
  static const Color accent40 = Color(0x66C9A87C); // 40% — input focus border
  static const Color accent50 = Color(0x80C9A87C); // 50% — selected border
  static const Color accent60 = Color(0x99C9A87C); // 60%

  // ── Accent alias names (same values, semantic intent) ────────────────
  static const Color accentSelectedFill = accent10;
  static const Color accentSelectedBorder = accent50;
  static const Color borderAccent40 = accent40;
  static const Color timelineDotFill = accent30;

  // ── Button ───────────────────────────────────────────────────────────
  static const Color btn = Color(0xFF695E4E); // solid CTA — warm umber
  static const Color btnHover = Color(0xFF5A5043);
  static const Color btnBorderGhost = Color(0x66695E4E); // btn umber @ 40%

  // ── Stone (cool gray) ───────────────────────────────────────────────
  static const Color stone = Color(0xFFA8A29E);
  static const Color stone50 = Color(0x80A8A29E); // 50%
  static const Color stone70 = Color(0xB3A8A29E); // 70%

  // ── Text alpha variants ──────────────────────────────────────────────
  static const Color text40 = Color(0x66141413); // 40%
  // The portion ruler's filled range, thumb ring and anchor ticks. Neutral on
  // purpose: that track already carries the silhouette row above it, and an
  // accent bar there competes with the art instead of supporting it.
  static const Color text30 = Color(0x4D141413); // 30%
  static const Color textMuted50 = Color(0x806E6D66); // 50%
  static const Color textMuted60 = Color(0x996E6D66); // 60%
  static const Color textMuted70 = Color(0xB36E6D66); // 70% — macro-bar labels
  static const Color textMuted80 = Color(0xCC6E6D66); // 80% — legacy-macro note
  static const Color placeholderMuted40 = Color(0x666E6D66); // 40%

  // ── Hover alpha variants ─────────────────────────────────────────────
  // Only for washes over an OPAQUE LIGHTER surface (a white card, a field). On
  // the canvas itself they no longer register — see [pressWash].
  static const Color hover40 = Color(0x66F0EAE0); // 40%
  static const Color hover50 = Color(0x80F0EAE0); // 50%

  /// Press wash for controls that sit transparent on the canvas.
  ///
  /// The warm [hover] washes are a lighter cream than the canvas, so on a
  /// transparent-background control they composite to within ~3 points of the
  /// page — an invisible press. This is the same interaction in the neutral
  /// direction: ink at 6%, which darkens legibly over any surface in the
  /// system. Warm washes stay warm where they cover something lighter.
  static const Color pressWash = Color(0x0F141413); // ink @ 6%

  /// Press wash for controls sitting on an INK surface — the muted-grey band
  /// ([bandSurface]) the relog picker and the under-logged notice paint.
  ///
  /// The third case of the same rule: warm for selected, ink for
  /// pressed-on-page, white for pressed-on-ink. Both warm washes and
  /// [pressWash] are darker or barely off the band, so neither registers there.
  /// Deliberately far lighter than [cardWhite30] — at 30%+ this reads as a
  /// highlight bar rather than a press.
  static const Color pressWashOnInk = Color(0x1FFFFFFF); // white @ 12%

  // ── Danger alpha variants ────────────────────────────────────────────
  // Washes and hairlines behind destructive UI. These existed as hardcoded
  // hexes at six call sites, which is how they silently kept the old terracotta
  // when [danger] moved; they are tokens now so the next change carries them.
  static const Color danger70 = Color(0xB3D11A1A); // 70%
  static const Color danger30 = Color(0x4DD11A1A); // 30% — danger hairline
  static const Color danger10 = Color(0x1AD11A1A); // 10% — pressed/fill wash
  static const Color danger06 = Color(0x0FD11A1A); // 6% — quiet error card fill

  /// Cheat-meal marker, for a GLYPH standing on its own.
  ///
  /// The cheat language is tan, but [accent] is 2.2:1 on a white sheet — fine
  /// as a *fill* behind an ink glyph (which is how the cheat cards and the
  /// heatmap use it), below the 3:1 non-text minimum as a mark in its own
  /// right. Same warm family, deep enough to read at 4.5:1.
  static const Color cheatMark = Color(0xFF8B7355);

  // ── Macros ───────────────────────────────────────────────────────────
  static const Color macroProtein = Color(0xFFC9A87C);
  static const Color macroCarbs = Color(0xFF8B7355);
  static const Color macroFat = Color(0xFFA8A29E);

  // ── Status ───────────────────────────────────────────────────────────
  static const Color success = Color(0xFF7CA368); // sage (heatmap/legacy)
  // Fresh emerald for "on target" cards — brighter + cleaner than the olive
  // sage, reads modern against the warm cream surface.
  static const Color successAccent = Color(0xFF1FA971); // emerald — text + bar
  static const Color successDark = Color(
    0xFF14855A,
  ); // deeper emerald — figures
  static const Color successFaint = Color(0xFFEAF7F0); // mint — met-card fill
  static const Color successBorder = Color(
    0x331FA971,
  ); // emerald @ 20% — hairline
  /// Destructive actions — delete, remove, sign out — and error text.
  ///
  /// A plain red, not the old terracotta `#D37B69`. The terracotta was a warm
  /// desaturated accent that sat closer to the tan palette than to a warning:
  /// it read as decorative rather than destructive, and at 2.7:1 on the canvas
  /// it was the weakest text colour in the app. This is **4.8:1 — WCAG AA for
  /// normal text** — and unmistakably red.
  ///
  /// The obvious picks miss AA on this canvas: iOS system red `#FF3B30` is
  /// 3.1:1 and Tailwind red-600 `#DC2626` is 4.27:1, both below the 4.5
  /// threshold. `danger` is a TEXT colour here (delete/sign-out row labels,
  /// error copy, `NhamButtonVariant.danger`), so it has to clear it outright
  /// rather than lean on the large-text exemption.
  ///
  /// [danger] is for ACTIONS and ERRORS only. "Your numbers are off" is
  /// [offTarget], and the heatmap keeps its own scale — see both below.
  static const Color danger = Color(0xFFD11A1A);

  /// Over/under target — the calorie ring's overflow arc, the exceed state on a
  /// target bar, a nutrient figure past its limit, a "short by" figure.
  ///
  /// This keeps the terracotta that [danger] used to be, on purpose. Being over
  /// your calories is information, not a destructive act, and the ring's own
  /// docs say "never red, never a pill" — a dashboard that turns pure red when
  /// you go 10 kcal over is alarming in a way the old shared colour never was.
  /// It only looked like `danger` because both were terracotta; splitting the
  /// token is what lets destructive UI go properly red without dragging the
  /// dashboard along.
  static const Color offTarget = Color(0xFFD37B69);
  static const Color offTarget70 = Color(0xB3D37B69); // 70% — bar tick

  // ── Adherence heatmap diverging scale ────────────────────────────────
  static const Color heatmapOnTarget = Color(0xFF7CA368);
  static const Color heatmapClose = Color(0xFFA6C495);
  static const Color heatmapSlight = Color(0xFFD4C9AD);
  static const Color heatmapModerate = Color(0xFFE09C84);
  static const Color heatmapFar = Color(0xFFD37B69);
  static const Color heatmapBarMiss = Color(0xFFD4C9AD);

  // ── Settings + onboarding neutral/cream palette ──────────────────────
  static const Color inputBorder = Color(
    0xFFE2DFD4,
  ); // unified neutral hairline
  static const Color inputBorder40 = Color(0x66E2DFD4);
  static const Color textWarm = Color(0xFF7B6F62);
  static const Color textHelp = Color(0xFF8B8682);
  static const Color textSelected = Color(0xFF6F6556);
  static const Color cream = Color(0xFFFDFCF8);
  static const Color cream95 = Color(0xF2FDFCF8); // 95%
  static const Color cardCream = Color(0xFFFFFCF8);
  static const Color selectedCard = Color(0xFFFFF8EF);
  static const Color selectedSegment = Color(0xFFFBF2E6);
  static const Color btnDarkHover = Color(0xFF1C1917);
  static const Color btnDarkHover2 = Color(0xFF3D3425);
}
