/// Where everything in the open anchored menu goes, as pure geometry against
/// numbers the route measured: the item the menu belongs to, and the card
/// beside it. `anchored_menu_layer.dart` only paints what this decides, so the
/// flips and clamps are tested without a route or a dialog barrier in the way
/// (`test/shared/widgets/menu/anchored_menu_layer_test.dart`).
///
/// A caller that pins a copy of the item also LIFTS it: grown by the hold's
/// lift, and moved or shrunk only as far as it takes to show it WHOLE with the
/// card beside it. The whole-item rule is the owner's (2026-10-22, for the meal
/// cards): a card half under the gauges or the composer is lifted out in full,
/// and one taller than the screen is scaled down to fit.
/// `CupertinoContextMenu` did that for the cards until 2026-11-05.
library;

import 'dart:math' as math;

import 'package:flutter/painting.dart';

import '../../../theme/kallo_theme.dart';
import 'kallo_menu_card.dart' show kKalloMenuWidth;

/// [item] is where the item shows while the menu is open — the anchor itself
/// unless it lifts; [top] and [left] place the card; [flipped] says the card
/// is above the item, which is the corner it grows out of.
typedef AnchoredMenuPlacement =
    ({Rect item, double top, double left, bool flipped});

/// Places a card [menuHeight] tall beside [anchor] (a rect in the [overlay]'s
/// coordinates), sharing its [leading] or trailing edge. [lift] null leaves
/// the item where it is; otherwise it lifts to that scale (see the library
/// doc).
///
/// The safe insets count: a card ending under the home indicator has a last
/// row nobody can tap. So does the KEYBOARD, and it is the bigger of the two:
/// [overlay] is the full-screen root overlay, and while the composer is
/// focused `padding.bottom` nets to 0 whereas `viewInsets.bottom` carries the
/// keyboard's height. Read only the padding and a menu on the last sent bubble
/// counts the keyboard as room, never flips, and paints BEHIND it.
/// (`thread_dock_insets.dart` pays the same pair for the same reason.)
AnchoredMenuPlacement placeAnchoredMenu({
  required Rect anchor,
  required Size overlay,
  required EdgeInsets padding,
  required EdgeInsets viewInsets,
  required double menuHeight,
  required bool leading,
  double? lift,
}) {
  const gap = KalloSpacing.sp2;
  final ceiling = padding.top + KalloSpacing.sp3;
  final floor = overlay.height - math.max(padding.bottom, viewInsets.bottom);
  final lifted =
      lift == null
          ? null
          : _lifted(
            anchor: anchor,
            lift: lift,
            trailing: !leading,
            width: overlay.width,
            ceiling: ceiling,
            floor: floor,
            menuHeight: menuHeight,
          );
  final item = lifted?.rect ?? anchor;
  // Below the item unless the card would run off the bottom — then above it,
  // same gap, same edge. A lifted item already chose its side.
  final flipped = lifted?.above ?? item.bottom + gap + menuHeight > floor;
  final wantedTop = flipped ? item.top - gap - menuHeight : item.bottom + gap;
  // The vertical twin of the horizontal clamp below. A bubble taller than the
  // screen minus the card flips a card whose header and first row would land
  // above y=0; when the screen is too short to hold both bounds the top one
  // wins, exactly as the leading edge wins horizontally — a card that
  // overhangs the floor still shows the header that says what it is.
  final top =
      ceiling >= floor - menuHeight
          ? ceiling
          : wantedTop.clamp(ceiling, floor - menuHeight);

  final wanted = leading ? item.left : item.right - kKalloMenuWidth;
  final maxLeft = overlay.width - kKalloMenuWidth - KalloSpacing.sp3;
  final left =
      maxLeft <= KalloSpacing.sp3
          ? KalloSpacing.sp3
          : wanted.clamp(KalloSpacing.sp3, maxLeft);
  return (item: item, top: top, left: left, flipped: flipped);
}

/// The rect [anchor] lifts to, in the same coordinates, and whether the card
/// goes [above] it. [lift] is the scale it grows to, about the midpoint of its
/// [trailing] (else leading) side; [width] is the overlay's; [ceiling] and
/// [floor] bound what is on screen and tappable; [menuHeight] is the card that
/// has to fit beside it.
///
/// The side is returned, not re-derived from the rect: a card placed flush
/// against the floor sits a rounding error past it, and re-testing
/// `bottom > floor` flipped the card onto the item.
({Rect rect, bool above}) _lifted({
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
  // fit between the ceiling and the floor — however small that makes a long
  // expanded card. The floor on the scale only keeps it positive.
  final roomWide = math.max(1.0, (width - 2 * gap) / anchor.width);
  final roomTall = (floor - ceiling - gap - menuHeight) / anchor.height;
  final scale = math.max(0.01, math.min(math.min(lift, roomWide), roomTall));
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
  final goAbove = above.abs() < below.abs();
  return (
    rect: grown.shift(Offset(dx, goAbove ? above : below)),
    above: goAbove,
  );
}
