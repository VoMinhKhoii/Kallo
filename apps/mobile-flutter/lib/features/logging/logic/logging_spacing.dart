import 'package:flutter/widgets.dart';

import '../../../theme/kallo_theme.dart';

/// The logging feed's ONE vertical rhythm. Every gap on the tab resolves to one
/// of these four steps, so the day reads as a single stack instead of a pile of
/// blocks each with its own margin.
abstract final class LoggingSpacing {
  /// Between the feed's big blocks: date strip ↔ macro summary ↔ card list ↔
  /// composer.
  ///
  /// **The dense-8 exemption is retired** (native pass, 2026-08-31). This was 8
  /// — the one surface allowed to run tighter than the app's 12px rhythm,
  /// because the feed is a dense scrolling list. On the native canvas the cards
  /// are borderless and separate by surface alone, so at 8 a sent bubble and
  /// the meal card answering it read as one bruised block rather than as two
  /// cards. Everything on the tab is now on the house step, and this token
  /// stays only to keep naming the ROLE ([turn] names the conversational beat).
  static const double block = KalloSpacing.sp3; // 12

  /// The conversational rhythm: one turn to the next, and the parts WITHIN a
  /// turn — divider ↔ message ↔ card. One value for all of them, because the
  /// eye reads them as the same beat and any difference registers as a mistake
  /// rather than as hierarchy.
  ///
  /// 12 is the app-wide rhythm (`kallo-design/mobile.md`), so this is the house
  /// step rather than a new one — and since the native pass it is the ONLY step
  /// between anything stacked on this tab (see [block]).
  static const double turn = KalloSpacing.sp3; // 12

  /// Inside a card: the space above/below every hairline and between the
  /// card's sections.
  static const double section = KalloSpacing.sp3; // 12

  /// Vertical padding on one ingredient / meal-item row. Neighbouring rows sit
  /// `row * 2` apart, so the list breathes at [block] without doubling it.
  static const double row = KalloSpacing.sp1; // 4

  /// A card ↔ the action icons underneath it. Tiny, because the icon buttons
  /// carry their own centring inset.
  static const double actions = KalloSpacing.sp0_5; // 2

  /// The header strip that the week picker morphs inside — its collapsed chip
  /// layer and its expanded day row share this height, or the morph pushes the
  /// feed as it runs. ONE number, because the two layers must agree exactly.
  ///
  /// Sized to the content at 1.0x: a day cell stacks weekday (Meta 14 →
  /// 17.5), day number (Body 16 → 20.8), the meal dot (6) and two 2pt gaps
  /// inside 4pt of vertical padding — 56.3 in total. 58 leaves 1.7 of slack on
  /// the 2px grid (60 → 58 with the metric-compensated ramp, 2026-09-02; 56
  /// would overflow by 0.3 and throw). Re-derive this sum whenever Body or
  /// Meta moves, and prefer [stripFor] in layout: only the two text lines
  /// grow with Dynamic Type, and at the 1.3x cap they overflowed this constant
  /// by 10pt.
  static const double strip = 58;

  /// The text lines inside [strip] — the only part Dynamic Type scales.
  static const double _stripText = 17.5 + 20.8;

  /// [strip] at the ambient text scale: the fixed chrome (padding, gaps, dot,
  /// slack) plus the two text lines scaled. Equals [strip] at 1.0x.
  static double stripFor(BuildContext context) =>
      (strip - _stripText) + MediaQuery.textScalerOf(context).scale(_stripText);

  /// A card's own inset. Vertical is 12, not the horizontal 16, so the padding
  /// reads EQUAL on all four sides: the first and last lines each carry ~4px of
  /// line-height slack above/below their glyphs, which a flat 16 would stack on
  /// top of. Optical balance, not geometric.
  static const EdgeInsets card = EdgeInsets.fromLTRB(
    KalloSpacing.sp4, // 16
    KalloSpacing.sp3, // 12
    KalloSpacing.sp4,
    KalloSpacing.sp3,
  );

  /// The composer card's inset — ASYMMETRIC, because only one side of the card
  /// opens on text (Log artboard).
  ///
  /// Left is the full card gutter (16), so the placeholder, the typed sentence
  /// and the mode mark under it all start on the same line a meal card's text
  /// does. Right comes in to 8, where the send button's 44pt tap target already
  /// carries 6 of its own around a 32pt visual — at 16 the circle floated a
  /// quarter-inch off the edge. Top is 0 and bottom 6: the field owns its own
  /// 8/6 content padding, and the control row below is a 44pt target wrapping a
  /// 32pt button.
  ///
  /// Count every inset in the stack before setting the outermost one; a
  /// control-dense card needs less than a text-only one to land in the same
  /// place.
  static const EdgeInsets composer = EdgeInsets.fromLTRB(
    KalloSpacing.sp4, // 16 — the text gutter
    0, // the field carries its own top padding
    KalloSpacing.sp2, // 8 — the send target carries the rest
    KalloSpacing.sp1_5, // 6
  );
}

/// One size and one hit target for every glyph on the logging tab — the action
/// icons beneath the cards are the reference, and the chevrons, steppers,
/// row-removes and composer controls all match them now.
abstract final class LoggingIcons {
  /// Glyph size for every icon-only control.
  ///
  /// Deliberately NOT [KalloIcons.primary]. The app-wide glyph is 24, which
  /// suits a row-leading icon that carries its label; these are dense clusters
  /// of icon-only controls — steppers flanking a number, a chevron on the card
  /// edge, a row-remove — where 24 crowds the card and the controls start to
  /// out-weigh the meal they belong to. This surface stays compact, and the
  /// divergence is the point rather than an oversight.
  ///
  /// 16 → [KalloIcons.tertiary] (18) with the Threads scale (2026-09-01): the
  /// divergence stands, but it now names the app's tertiary tier instead of a
  /// private number, and 16 read as a speck beside a 16pt row label.
  static const double size = KalloIcons.tertiary; // 18

  /// The action row under a card is the ONE cluster that leaves [size] for the
  /// app's card-action tier (native pass, 2026-08-31 — the Log artboard drew
  /// them at 24). Those five glyphs are the card's controls rather than
  /// furniture inside it, and at 16 they read as a row of specks under a card
  /// that is now borderless. Everything else on this surface — steppers, the
  /// collapse chevron, the composer's mode mark — stays at [size].
  ///
  /// 24 → 21 with the Threads icon tiers (2026-09-01): a control ON a card
  /// sits one step under navigation, so the row no longer out-weighs the meal.
  static const double action = KalloIcons.action; // 21

  /// Square tap target around that glyph — the app-wide target, unchanged.
  static const double hit = KalloIcons.hit;

  /// The visible wash behind a selected/pressed control: it hugs the glyph
  /// instead of filling [hit], so the tap target can stay at the iOS 44 for
  /// accessibility without the chosen state reading as a 44pt block under the
  /// card. Sized off [action] (24 + 4 either side), the largest glyph it wraps.
  static const double wash = 32;
}
