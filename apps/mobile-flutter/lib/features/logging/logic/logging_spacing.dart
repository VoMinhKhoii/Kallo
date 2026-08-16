import 'package:flutter/widgets.dart';

import '../../../theme/nham_theme.dart';

/// The logging feed's ONE vertical rhythm. Every gap on the tab resolves to one
/// of these four steps, so the day reads as a single stack instead of a pile of
/// blocks each with its own margin.
abstract final class LoggingSpacing {
  /// Between the feed's big blocks: date strip ↔ macro summary ↔ card list ↔
  /// composer.
  static const double block = NhamSpacing.sp2; // 8

  /// The conversational rhythm: one turn to the next, and the parts WITHIN a
  /// turn — divider ↔ message ↔ card. One value for all of them, because the
  /// eye reads them as the same beat and any difference registers as a mistake
  /// rather than as hierarchy.
  ///
  /// Wider than [block]: at 8 the turns ran together, with a card's CTA nearly
  /// touching the next turn's timestamp. 12 is the app-wide rhythm
  /// (`kallo-design/mobile.md`), so this is the house step rather than a new one.
  static const double turn = NhamSpacing.sp3; // 12

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

  /// The composer card's inset — tighter than [card] on three sides because the
  /// composer stacks two more insets of its own: the field's min-height centres
  /// its single line (~7px above the glyphs) and the send button's 44pt tap
  /// target wraps a 32pt visual (~6px below it).
  ///
  /// The top is the generous edge (10) because it is the only one above running
  /// text; the sides and bottom come right in to 4, where the field and the
  /// button row already carry inset of their own.
  ///
  /// At 4 the container is no longer what positions things: the text starts at
  /// 4 from the border, the mode icon at 8 (its own 4), and the send button's
  /// visual edge at 10 (a 32pt button centred in a 44pt tap target). That
  /// stagger was proportionally invisible at 12; it is not at 4.
  static const EdgeInsets composer = EdgeInsets.fromLTRB(
    NhamSpacing.sp1, // 4
    NhamSpacing.sp2_5, // 10 — above text, the one edge that keeps its room
    NhamSpacing.sp1,
    NhamSpacing.sp1, // 4 — under the buttons, which carry their own mass
  );
}

/// One size and one hit target for every glyph on the logging tab — the action
/// icons beneath the cards are the reference, and the chevrons, steppers,
/// row-removes and composer controls all match them now.
abstract final class LoggingIcons {
  /// Glyph size for every icon-only control.
  ///
  /// Deliberately NOT [NhamIcons.size]. The app-wide glyph is 24, which suits a
  /// row-leading icon that carries its label; these are dense clusters of
  /// icon-only controls — five actions under a card, steppers flanking a
  /// number, a chevron on the card edge — where 24 crowds the card and the
  /// controls start to out-weigh the meal they belong to. This surface stays
  /// compact, and the divergence is the point rather than an oversight.
  static const double size = 16;

  /// Square tap target around that glyph — the app-wide target, unchanged.
  static const double hit = NhamIcons.hit;

  /// The visible wash behind a selected/pressed control: it hugs the glyph
  /// instead of filling [hit], so the tap target can stay 36 for accessibility
  /// without the chosen state reading as a 36pt block under the card.
  static const double wash = 28;
}
