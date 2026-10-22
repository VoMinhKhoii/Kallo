import 'dart:ui';

import 'kallo_palette.dart';

/// The Nham design system color palette.
///
/// Transcribed from the web's `globals.css` `:root` tokens (the canonical
/// `--kallo-*` values). Visual direction: neutral canvas / ink / hairline with
/// warm interaction washes; tan accent kept for non-text moments only.
///
/// The canvas is `#F8F7F4` — the FOURTH canvas decision (2026-09-01), one
/// step lighter than the `#F4F3EF` it replaces, which itself superseded the
/// original warm `#F1F1EE` and the web-parity `#FCFCFC` resync. The `#FCFCFC`
/// comment predicted "if cards start reading flat, THAT is the knob to
/// re-decide" — they did, and `#F4F3EF` was that re-decision (2026-08-31,
/// native pass). `#F8F7F4` keeps its whole logic — still below white, still
/// borderless and shadowless cards — with a lighter, cooler-reading page,
/// chosen on-device. This is a sanctioned
/// divergence from the web token; do not resync without re-deciding again.
/// `track` (#EDECE7) sits close to this canvas — if bars read flat, `track`
/// is the next knob, not the canvas.
///
/// The `surface*` alpha ramps below MUST keep this hue: a scrim that fades
/// toward a stale canvas colour is a visible seam.
///
/// Every token except the two brand hues is a GETTER onto
/// [KalloPalette.current] — light, Dark or Aurora, switched at runtime from
/// Settings → Appearance (`theme_controller.dart`). The hexes and contrast
/// ratios quoted in this file are the LIGHT palette's; Dark's and Aurora's
/// live in `kallo_palette.dart`. A getter is not a constant, so a token cannot
/// sit inside a `const` expression — and must not be cached in a `static
/// final` either, which would keep the palette of its first read.
abstract final class KalloColors {
  static KalloPalette get _p => KalloPalette.current;

  // ── Core surfaces ────────────────────────────────────────────────────
  static Color get surface =>
      _p.surface; // app background — below white; cards need no border/shadow
  static Color get elev => _p.elev; // cards / sheets
  static Color get hover => _p.hover; // warm hover/select wash
  // Kept where it was when the canvas darkened: the canvas↔track step is the
  // whole point of this token, and against the brighter page it now sits
  // further below it, which is the direction that reads recessed.
  static Color get track => _p.track; // warm segmented/track
  static Color get track50 => _p.track50; // track @ 50%

  // ── Text ─────────────────────────────────────────────────────────────
  static Color get text => _p.text; // near-black ink
  // 6E6D66 → 7A7870 (2026-09-02): one step lighter so secondary text recedes
  // the way Threads' and the Claude app's does. 4.1:1 on the canvas, 4.4:1 on
  // white — deliberately under AA's 4.5 for small text; `text`, `danger` and
  // `mention` still clear it. Not for anything that must be READ to act.
  static Color get textMuted => _p.textMuted; // neutral muted
  static Color get textSoft => _p.textSoft; // soft long-body text

  // ── Accent ───────────────────────────────────────────────────────────
  static Color get accent => _p.accent; // signature tan
  static Color get accentDark => _p.accentDark;

  // ── Brand sweep ──────────────────────────────────────────────────────
  /// The two hues of the brand sweep: the wash behind `/start` and every
  /// onboarding step ([StartAurora]), and the fill of the tab bar's "+"
  /// ([KalloGradients.brandSweep]).
  ///
  /// Tokens because there are now two consumers and they must not drift — the
  /// aurora paints them at 16–55% alpha and the "+" at full opacity, which is
  /// exactly the pair that would silently diverge if each kept its own literal.
  static const Color brandApricot = Color(0xFFFFD2B0);
  static const Color brandLilac = Color(0xFFDCC4FF);

  // ── The muted band ───────────────────────────────────────────────────
  // The surface the composer's inline under-logged notice (`PartialDayNotice`)
  // and the relog `/` picker both paint: white copy on muted grey. Pinned to
  // the pre-2026-09-02 muted value rather than aliased to [textMuted]: this is
  // the lightest grey that still clears 4.5:1 for WHITE copy (~5.2:1), and
  // lightening the text token must not silently wash the band under it.
  static Color get bandSurface => _p.bandSurface;
  static Color get bandForeground => _p.bandForeground;

  /// Only for GLYPHS on the band, never copy. Text there must stay full white
  /// to hold 4.5:1 against [bandSurface]; an icon carries no text and is not
  /// held to it. Matches the under-logged notice's dismiss glyph.
  static Color get bandForeground70 => _p.bandForeground70; // white @ 70%

  /// A committed relog pick, rendered inline in the composer as `/Phở bò`.
  ///
  /// The one deliberate blue: a pick is a REFERENCE to stored data, not typed
  /// prose, and the warm palette has no hue that reads "this token is not free
  /// text" without also reading as a warning.
  ///
  /// Darker than the web's `--kallo-mention` (#4A90D9) on purpose. That value is
  /// 3.34:1 on the composer's white field — under AA for 14px body text. This
  /// one measures 4.86:1 at the same size, which is the bar every other text
  /// token in this palette is held to.
  static Color get mention => _p.mention;

  // ── Premium lock marker (PremiumChip / PremiumDot) ───────────────────
  /// A soft blue, not the paywall gold: the marker only says "this is in
  /// Premium" beside a working option, and gold would compete with the one
  /// gold CTA the paywall owns. Same values as web's `--kallo-premium-*`.
  static Color get premiumChipFill => _p.premiumChipFill;
  static Color get premiumChipBorder => _p.premiumChipBorder;
  static Color get premiumChipText => _p.premiumChipText;
  static Color get premiumDot => _p.premiumDot;

  // ── Borders ──────────────────────────────────────────────────────────
  static Color get border => _p.border; // neutral hairline
  static Color get borderSoft => _p.borderSoft; // hairline @ 60%
  static Color get borderHalf => _p.borderHalf; // hairline @ 50%
  static Color get borderFaint => _p.borderFaint; // hairline @ 30%
  static Color get borderBiscotti40 => _p.borderBiscotti40; // hairline @ 40%
  static Color get border70 => _p.border70; // hairline @ 70%
  static Color get border15 => _p.border15; // hairline @ 15%

  // ── Translucent surfaces ─────────────────────────────────────────────
  static Color get elevTranslucent => _p.elevTranslucent; // card/elev @ 80%
  static Color get surface80 => _p.surface80; // canvas @ 80%
  // Scrim ramp (composer dock). These MUST stay the same hue as [surface] —
  // a scrim that fades toward a stale canvas colour is a visible seam, which
  // is the exact thing the ramp exists to remove.
  static Color get surface0 => _p.surface0; // canvas @ 0%
  static Color get surface35 => _p.surface35; // canvas @ 35%
  static Color get surface85 => _p.surface85; // canvas @ 85%
  static Color get cardWhite55 => _p.cardWhite55; // card white @ 55%
  static Color get cardWhite40 => _p.cardWhite40; // card white @ 40%
  static Color get cardWhite30 => _p.cardWhite30; // card white @ 30%

  // ── Accent alpha variants ────────────────────────────────────────────
  static Color get accent05 => _p.accent05; // 5%
  static Color get accent07 => _p.accent07; // 7%
  static Color get accent10 => _p.accent10; // 10% — selected fill
  static Color get accent15 => _p.accent15; // 15%
  static Color get accent20 => _p.accent20; // 20% — hero divider
  static Color get accent30 => _p.accent30; // 30% — timeline dot fill
  static Color get accent35 => _p.accent35; // 35%
  static Color get accent40 => _p.accent40; // 40% — input focus border
  static Color get accent50 => _p.accent50; // 50% — selected border
  static Color get accent60 => _p.accent60; // 60%

  // ── Accent alias names (same values, semantic intent) ────────────────
  static Color get accentSelectedFill => _p.accentSelectedFill;
  static Color get accentSelectedBorder => _p.accentSelectedBorder;
  static Color get borderAccent40 => _p.borderAccent40;
  static Color get timelineDotFill => _p.timelineDotFill;

  // ── Button ───────────────────────────────────────────────────────────
  // Two-tier button system (native pass, 2026-08-31):
  //  - auth & paywall CTAs (sign in, start free trial): [btnPrimary] fill,
  //    white label, 50pt, fully rounded;
  //  - every in-app primary (save, share, retry, tab-bar "+"): [btnPrimarySoft]
  //    fill, ink label, fully rounded. Same value as [hover] on purpose — one
  //    warm family for "actionable/active" (buttons, sent bubble, selected
  //    states, micro add-circles).
  // Umber [btn] is retired as a button fill — it survives only on toggles and
  // progress fills until those call sites migrate to their own semantics.
  static Color get btnPrimary =>
      _p.btnPrimary; // black & white CTA — auth/paywall
  static Color get btnPrimarySoft =>
      _p.btnPrimarySoft; // beige + ink — in-app primary
  static Color get btn => _p.btn; // legacy umber — toggles/progress
  static Color get btnHover => _p.btnHover;
  static Color get btnBorderGhost => _p.btnBorderGhost; // btn umber @ 40%

  // ── Stone (cool gray) ───────────────────────────────────────────────
  static Color get stone => _p.stone;
  static Color get stone50 => _p.stone50; // 50%
  static Color get stone70 => _p.stone70; // 70%

  // ── Text alpha variants ──────────────────────────────────────────────
  static Color get text40 => _p.text40; // 40%
  // The portion ruler's filled range, thumb ring and anchor ticks. Neutral on
  // purpose: that track already carries the silhouette row above it, and an
  // accent bar there competes with the art instead of supporting it.
  static Color get text30 => _p.text30; // 30%
  static Color get text25 => _p.text25; // 25% — ruler anchor ticks
  static Color get textMuted50 => _p.textMuted50; // 50%
  static Color get textMuted60 => _p.textMuted60; // 60%
  static Color get textMuted70 => _p.textMuted70; // 70% — macro-bar labels
  static Color get textMuted80 => _p.textMuted80; // 80% — legacy-macro note
  static Color get placeholderMuted40 => _p.placeholderMuted40; // 40%

  // ── Hover alpha variants ─────────────────────────────────────────────
  // Only for washes over an OPAQUE LIGHTER surface (a white card, a field). On
  // the canvas itself they no longer register — see [pressWash].
  static Color get hover40 => _p.hover40; // 40%
  static Color get hover50 => _p.hover50; // 50%

  /// Press wash for controls that sit transparent on the canvas.
  ///
  /// The warm [hover] washes are a lighter cream than the canvas, so on a
  /// transparent-background control they composite to within ~3 points of the
  /// page — an invisible press. This is the same interaction in the neutral
  /// direction: ink at 6%, which darkens legibly over any surface in the
  /// system. Warm washes stay warm where they cover something lighter.
  static Color get pressWash => _p.pressWash; // ink @ 6%

  /// The app's one modal scrim — black at 50%, behind dialogs and the nav
  /// drawer, and what the web dialog paints. Named because it was written
  /// twice (the theme and the alert surface) and could have drifted.
  static Color get scrim => _p.scrim;

  /// Press wash for controls sitting on an INK surface — the muted-grey band
  /// ([bandSurface]) the relog picker and the under-logged notice paint.
  ///
  /// The third case of the same rule: warm for selected, ink for
  /// pressed-on-page, white for pressed-on-ink. Both warm washes and
  /// [pressWash] are darker or barely off the band, so neither registers there.
  /// Deliberately far lighter than [cardWhite30] — at 30%+ this reads as a
  /// highlight bar rather than a press.
  static Color get pressWashOnInk => _p.pressWashOnInk; // white @ 12%

  /// Press wash for the one GOLD surface — the paywall's buy button.
  ///
  /// The fourth case of the same rule, and the only one that darkens rather
  /// than lightens: the gold gradient runs #FBE27A→#EDBF2F, so [pressWashOnInk]
  /// vanishes into it and [pressWash] at 6% is too faint to register against a
  /// fill that bright. It lives here rather than in the paywall because a press
  /// wash is a system statement, even when only one surface needs this one —
  /// the gold HEXES stay fenced in `plans/gold_surface.dart`.
  static Color get pressWashOnGold => _p.pressWashOnGold; // ink @ 12%

  // ── Danger alpha variants ────────────────────────────────────────────
  // Washes and hairlines behind destructive UI. These existed as hardcoded
  // hexes at six call sites, which is how they silently kept the old terracotta
  // when [danger] moved; they are tokens now so the next change carries them.
  /// Pressed [danger], the way [btnHover] is pressed [btn]. Darker, not
  /// lighter: the fill already sits darker than the card behind it, so a
  /// lighter press would read as the button lifting away rather than going in.
  static Color get dangerHover => _p.dangerHover;

  static Color get danger70 => _p.danger70; // 70%
  static Color get danger30 => _p.danger30; // 30% — danger hairline
  static Color get danger10 => _p.danger10; // 10% — pressed/fill wash
  static Color get danger06 => _p.danger06; // 6% — quiet error card fill

  /// Cheat-meal marker, for a GLYPH standing on its own.
  ///
  /// The cheat language is tan, but [accent] is 2.2:1 on a white sheet — fine
  /// as a *fill* behind an ink glyph (which is how the cheat cards and the
  /// heatmap use it), below the 3:1 non-text minimum as a mark in its own
  /// right. Same warm family, deep enough to read at 4.5:1.
  static Color get cheatMark => _p.cheatMark;

  // ── Macros ───────────────────────────────────────────────────────────
  /// ONE macro palette, app-wide: nutrition charts, the composition bar, the
  /// dashboard dock, the logging feed and the cheat sliders all draw these.
  ///
  /// They split by HUE rather than by value, which is what lets three of them
  /// sit adjacent inside a 6–10px stacked bar and stay legible. The earlier
  /// tan-on-taupe-on-gray trio (`#C9A87C`/`#8B7355`/`#A8A29E`) was three
  /// low-chroma neighbours and turned to mud at that size; it was kept for the
  /// large-fill surfaces for a while and then retired, so there is no longer a
  /// quiet set to fall back to.
  ///
  /// Mirrors the web `--kallo-macro-*` tokens in `app/globals.css`.
  static Color get macroProtein => _p.macroProtein; // berry rose
  static Color get macroCarbs => _p.macroCarbs; // apricot
  static Color get macroFat => _p.macroFat; // golden yellow

  // ── Macros, charted ──────────────────────────────────────────────────
  /// Aliases of the macro trio, kept so chart call sites keep reading. There is
  /// no longer a separate chart palette.
  static Color get chartProtein => _p.chartProtein;
  static Color get chartCarbs => _p.chartCarbs;
  static Color get chartFat => _p.chartFat;

  /// What an unselected column collapses to while another one is picked.
  static Color get chartMuted => _p.chartMuted;

  // ── Status ───────────────────────────────────────────────────────────
  static Color get success => _p.success; // sage (heatmap/legacy)
  // Fresh emerald for "on target" cards — brighter + cleaner than the olive
  // sage, reads modern against the warm cream surface.
  static Color get successAccent => _p.successAccent; // emerald — text + bar
  static Color get successDark => _p.successDark; // deeper emerald — figures
  static Color get successFaint => _p.successFaint; // mint — met-card fill
  static Color get successBorder =>
      _p.successBorder; // emerald @ 20% — hairline
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
  /// error copy, `KalloButtonVariant.danger`), so it has to clear it outright
  /// rather than lean on the large-text exemption.
  ///
  /// [danger] is for ACTIONS and ERRORS only. "Your numbers are off" is
  /// [offTarget], and the heatmap keeps its own scale — see both below.
  static Color get danger => _p.danger;

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
  static Color get offTarget => _p.offTarget;
  static Color get offTarget70 => _p.offTarget70; // 70% — bar tick

  // ── Adherence heatmap diverging scale ────────────────────────────────
  static Color get heatmapOnTarget => _p.heatmapOnTarget;
  static Color get heatmapClose => _p.heatmapClose;
  static Color get heatmapSlight => _p.heatmapSlight;
  static Color get heatmapModerate => _p.heatmapModerate;
  static Color get heatmapFar => _p.heatmapFar;
  static Color get heatmapBarMiss => _p.heatmapBarMiss;

  // ── Settings + onboarding neutral/cream palette ──────────────────────
  static Color get inputBorder => _p.inputBorder; // unified neutral hairline
  static Color get inputBorder40 => _p.inputBorder40;
  static Color get textWarm => _p.textWarm;
  static Color get textHelp => _p.textHelp;
  static Color get textSelected => _p.textSelected;
  static Color get cream => _p.cream;
  static Color get cream95 => _p.cream95; // 95%
  static Color get cardCream => _p.cardCream;
  static Color get selectedCard => _p.selectedCard;
  static Color get selectedSegment => _p.selectedSegment;
  static Color get btnDarkHover => _p.btnDarkHover;
  static Color get btnDarkHover2 => _p.btnDarkHover2;
}
