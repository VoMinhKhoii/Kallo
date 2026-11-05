/// Where a held item's pinned copy settles while its menu is open: grown by
/// the hold's lift, and moved or shrunk only as far as it takes to show the
/// item WHOLE with the card beside it.
///
/// The whole-item rule is the owner's (2026-10-22, for the meal cards): a card
/// half under the gauges or the composer is lifted out in full, and one taller
/// than the screen is scaled down to fit. `CupertinoContextMenu` did that for
/// the cards until 2026-11-05; the app's menu does it now, for every caller
/// that pins a copy (`anchored_menu_layer.dart`).
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../theme/kallo_theme.dart';

/// The band of the overlay a menu and its lifted item may use. The safe
/// insets count: a card ending under the home indicator has a last row nobody
/// can tap. So does the KEYBOARD, and it is the bigger of the two:
/// [overlaySize] is the full-screen root overlay, and while the composer is
/// focused `padding.bottom` nets to 0 whereas `viewInsets.bottom` carries the
/// keyboard's height. Read only the padding and a menu on the last sent bubble
/// counts the keyboard as room, never flips, and paints BEHIND it.
/// (`thread_dock_insets.dart` pays the same pair for the same reason.)
({double ceiling, double floor}) menuBounds(
  BuildContext context,
  Size overlaySize,
) => (
  ceiling: MediaQuery.paddingOf(context).top + KalloSpacing.sp3,
  floor:
      overlaySize.height -
      math.max(
        MediaQuery.paddingOf(context).bottom,
        MediaQuery.viewInsetsOf(context).bottom,
      ),
);

/// The rect [anchor] lifts to, in the same coordinates. [lift] is the scale
/// it grows to, about the midpoint of its [trailing] (else leading) side;
/// [width] is the overlay's; [ceiling] and [floor] bound what is on screen
/// and tappable; [menuHeight] is the card that has to fit beside it.
Rect liftedAnchor({
  required Rect anchor,
  required double lift,
  required bool trailing,
  required double width,
  required double ceiling,
  required double floor,
  required double menuHeight,
}) {
  const gap = KalloSpacing.sp2;
  // Grow, but never past the screen's sides — a full-width card takes what
  // room there is — and shrink only when the item and the card cannot both
  // fit between the ceiling and the floor.
  final roomWide = math.max(1.0, (width - 2 * gap) / anchor.width);
  final roomTall = (floor - ceiling - gap - menuHeight) / anchor.height;
  final scale = math.max(0.25, math.min(math.min(lift, roomWide), roomTall));
  final growFrom = trailing ? Alignment.centerRight : Alignment.centerLeft;
  final grown = growFrom.inscribe(anchor.size * scale, anchor);

  final dx =
      grown.left < gap
          ? gap - grown.left
          : grown.right > width - gap
          ? width - gap - grown.right
          : 0.0;
  // The card goes below or above, whichever moves the item less; an item
  // that already shows whole with room for the card does not move at all.
  double fit(double top, double bottom) =>
      top < ceiling
          ? ceiling - top
          : bottom > floor
          ? floor - bottom
          : 0.0;
  final below = fit(grown.top, grown.bottom + gap + menuHeight);
  final above = fit(grown.top - gap - menuHeight, grown.bottom);
  final dy = below.abs() <= above.abs() ? below : above;
  return grown.shift(Offset(dx, dy));
}

/// The pinned copy, laid out at [from] — it never re-flows — and carried onto
/// [to] by a paint-only transform as [animation] runs.
class AnchoredMenuPin extends StatelessWidget {
  const AnchoredMenuPin({
    super.key,
    required this.from,
    required this.to,
    required this.animation,
    required this.child,
  });

  final Rect from;
  final Rect to;
  final Animation<double> animation;
  final Widget child;

  @override
  Widget build(BuildContext context) => Positioned.fromRect(
    rect: from,
    child: IgnorePointer(
      child: AnimatedBuilder(
        animation: animation,
        builder: (_, copy) {
          final at = Rect.lerp(from, to, animation.value)!;
          final scale = at.width / from.width;
          return Transform(
            transform: Matrix4.translationValues(
              at.left - from.left,
              at.top - from.top,
              0,
            )..scaleByDouble(scale, scale, 1, 1),
            child: copy,
          );
        },
        // The copy is drawn above every Material in the app; without one of
        // its own its text wears the framework's yellow "no Material"
        // underline (seen on the simulator, 2026-10-23).
        child: Material(type: MaterialType.transparency, child: child),
      ),
    ),
  );
}
