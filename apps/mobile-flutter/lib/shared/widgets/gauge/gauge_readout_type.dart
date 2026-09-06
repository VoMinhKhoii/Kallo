/// The type a dial's readout is set in.
///
/// Its own file, not the calm ramp's, because a figure pinned inside a 30–52pt
/// arc is sized by the ARC: the mouth is a fixed number of points across, and
/// type that outgrows it is either clamped (and then it is not the size it
/// claims) or it crosses the stroke. [dashCaption]'s doc already names this as
/// the one licensed exception — "a number pinned inside a gauge" — and these
/// four styles are that exception made explicit, in one place, instead of four
/// call sites reaching for whatever tier happens to measure right this month.
///
/// The sizes are not new. They are what the dial shipped at and what the
/// reference screenshot measures: at @3x its compact macro figure inks 32px
/// tall and its denominator 28px, which is 14 and 12 to within a pixel. The
/// reading ramp has moved twice underneath them (14/12 → 17/15 → 16/14) and
/// they stayed put each time — so every style here is PINNED, not aliased to
/// a ramp token that may move again. The hero is the one exception: it IS the
/// ramp's hero.
library;

import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_typography.dart';

/// 17 / 400 — the figure a FULL-SIZE dial holds: the Today row's `202g`, the
/// Log header's calorie headline. Pinned (2026-09-02): it used to alias
/// [dashValue], which stepped to 16 with the metric-compensated ramp.
TextStyle gaugeFigure() => const TextStyle(
  fontFamily: KalloTextStyles.sansFamily,
  fontSize: 17,
  fontWeight: FontWeight.w400,
  height: 1.1,
  color: kInk,
  fontFeatures: [FontFeature.tabularFigures()],
);

/// 40 / 400 — the one hero figure, in the dial that gets the top of a screen.
TextStyle gaugeHeroFigure() => dashHero();

/// 14 / 400 — the figure a COMPACT dial holds. Two thirds of the radius means
/// two thirds of the room, so the compact variant steps its figure down one
/// notch and keeps the same denominator beneath it.
TextStyle gaugeCompactFigure() => const TextStyle(
  fontFamily: KalloTextStyles.sansFamily,
  fontSize: 14,
  fontWeight: FontWeight.w400,
  height: 1.3,
  color: kInk,
  fontFeatures: [FontFeature.tabularFigures()],
);

/// 14 / 400 muted — the WORD under a calorie figure ("kcal remaining", "còn
/// lại"). A phrase, not a figure: it is what sizes the calorie dial's box, so
/// it deliberately sits outside the clamp (see [GaugeDial.clampReadout]).
TextStyle gaugeUnit() => const TextStyle(
  fontFamily: KalloTextStyles.sansFamily,
  fontSize: 14,
  fontWeight: FontWeight.w400,
  height: 1.3,
  color: kInkMuted,
);

/// 12 / 400 muted, tabular — the quiet line under the figure: `/140g`, and the
/// calorie dial's `2.485/1.844`. The SAME size in both variants; the figure
/// above it is what changes, and that difference is the whole hierarchy.
TextStyle gaugeDenominator() => const TextStyle(
  fontFamily: KalloTextStyles.sansFamily,
  fontSize: 12,
  fontWeight: FontWeight.w400,
  height: 1.25,
  color: kInkMuted,
  fontFeatures: [FontFeature.tabularFigures()],
);

