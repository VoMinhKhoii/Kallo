import 'package:flutter/widgets.dart';

import '../../../theme/nham_theme.dart';

/// The logging feed's ONE vertical rhythm. Every gap on the tab resolves to one
/// of these four steps, so the day reads as a single stack instead of a pile of
/// blocks each with its own margin.
abstract final class LoggingSpacing {
  /// Between the feed's big blocks: date strip ↔ macro summary ↔ card list ↔
  /// composer, and between one meal card and the next.
  static const double block = NhamSpacing.sp2; // 8

  /// Inside a card: the space above/below every hairline and between the
  /// card's sections.
  static const double section = NhamSpacing.sp3; // 12

  /// Vertical padding on one ingredient / meal-item row. Neighbouring rows sit
  /// `row * 2` apart, so the list breathes at [block] without doubling it.
  static const double row = NhamSpacing.sp1; // 4

  /// A card ↔ the action icons underneath it. Tiny, because the icon buttons
  /// carry their own centring inset.
  static const double actions = NhamSpacing.sp0_5; // 2

  /// A card's own inset. Vertical is 12, not the horizontal 16, so the padding
  /// reads EQUAL on all four sides: the first and last lines each carry ~4px of
  /// line-height slack above/below their glyphs, which a flat 16 would stack on
  /// top of. Optical balance, not geometric.
  static const EdgeInsets card = EdgeInsets.fromLTRB(
    NhamSpacing.sp4, // 16
    NhamSpacing.sp3, // 12
    NhamSpacing.sp4,
    NhamSpacing.sp3,
  );
}

/// One size and one hit target for every glyph on the logging tab — the action
/// icons beneath the cards are the reference, and the chevrons, steppers,
/// row-removes and composer controls all match them now.
abstract final class LoggingIcons {
  /// Glyph size for every icon-only control.
  static const double size = 16;

  /// Square tap target (and pressed-wash bounds) around that glyph.
  static const double hit = 36;
}
