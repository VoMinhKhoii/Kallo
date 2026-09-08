/// The open anchored menu, as a widget: blur + scrim, the caller's pinned
/// copy at its own rect, and the card growing out of the anchor's corner.
///
/// Split out of `kallo_anchored_menu.dart`, which kept the public API and the
/// route (see that file for WHY the app owns this menu at all).
/// [showKalloAnchoredMenu] is this layer's only caller — it is public only
/// because Dart has no other way to hand it to a sibling file, and nothing
/// else should build it. The seam is worth having on its own terms: everything
/// here is pure geometry against numbers the route measured, so the flip and
/// the clamps can be pumped directly, with no route and no dialog barrier
/// in the way (`test/shared/widgets/menu/anchored_menu_layer_test.dart`).
library;

import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';
import 'kallo_menu_card.dart';

/// Which vertical edge the card shares with its anchor.
///
/// An enum rather than an [Alignment]: the parameter only ever meant "leading
/// or trailing", and an Alignment accepts `center`, `bottomLeft` and six more
/// values the geometry below would have silently treated as [trailing].
enum KalloMenuEdge {
  /// Left edges flush with the anchor (right edges, in an RTL mirror).
  leading,

  /// Right edges flush with the anchor — the default, and the one the sent
  /// bubble and the Circle "+" both want.
  trailing,
}

/// The scrim under the blur — ink at 20%, well short of the dialog scrim's
/// black/50, and INK rather than pure black so the blurred canvas keeps its
/// hue (`kallo_colors.dart`: a ramp fading toward the wrong neutral is a
/// visible seam). A menu is an extension of the page it hangs off, so that
/// page stays readable; a dialog is not, and dims it properly. The value
/// `circle_add_menu.dart` shipped.
const Color _menuScrim = Color(0x33141413);

const double _menuBlur = 8; // how far the page recedes behind the card

/// The open menu. [anchor] is a GLOBAL rect in the root overlay's coordinates
/// and [overlaySize] is that overlay's own size — both measured by the caller,
/// because nothing here may reach into the tree the menu was opened from.
class AnchoredMenuLayer extends StatelessWidget {
  const AnchoredMenuLayer({
    required this.anchor,
    required this.overlaySize,
    required this.animation,
    required this.edge,
    required this.rows,
    this.header,
    this.pinned,
    super.key,
  });

  final Rect anchor;
  final Size overlaySize;
  final Animation<double> animation;
  final KalloMenuEdge edge;
  final List<KalloMenuActionRow> rows;
  final String? header;
  final Widget? pinned;

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: KalloEase.enter,
      reverseCurve: KalloEase.exit,
    );
    final height = kalloMenuCardHeight(
      rows: rows.length,
      header: header != null,
    );
    // Below the anchor unless the card would run off the bottom — then above
    // it, same gap, same edge. The safe inset counts: a card ending under the
    // home indicator has a last row nobody can tap. So does the KEYBOARD, and
    // it is the bigger of the two: `overlaySize` is the full-screen root
    // overlay, and while the composer is focused `padding.bottom` nets to 0
    // whereas `viewInsets.bottom` carries the keyboard's height. Read only the
    // padding and a menu on the last sent bubble counts the keyboard as room,
    // never flips, and paints BEHIND it. (`thread_dock_insets.dart` pays the
    // same pair for the same reason.)
    final floor =
        overlaySize.height -
        math.max(
          MediaQuery.paddingOf(context).bottom,
          MediaQuery.viewInsetsOf(context).bottom,
        );
    final flipped = anchor.bottom + KalloSpacing.sp2 + height > floor;
    final wantedTop = flipped
        ? anchor.top - KalloSpacing.sp2 - height
        : anchor.bottom + KalloSpacing.sp2;
    // The vertical twin of the horizontal clamp below. A bubble taller than
    // the screen minus the card flips a card whose header and first row would
    // land above y=0; when the screen is too short to hold both bounds the top
    // one wins, exactly as the leading edge wins horizontally — a card that
    // overhangs the floor still shows the header that says what it is.
    final ceiling = MediaQuery.paddingOf(context).top + KalloSpacing.sp3;
    final top = ceiling >= floor - height
        ? ceiling
        : wantedTop.clamp(ceiling, floor - height);

    final leadingEdge = edge == KalloMenuEdge.leading;
    final wanted = leadingEdge ? anchor.left : anchor.right - kKalloMenuWidth;
    final maxLeft = overlaySize.width - kKalloMenuWidth - KalloSpacing.sp3;
    final left = maxLeft <= KalloSpacing.sp3
        ? KalloSpacing.sp3
        : wanted.clamp(KalloSpacing.sp3, maxLeft);

    return Stack(
      children: [
        // Decorative only — IgnorePointer so the dismiss tap reaches the
        // route's barrier underneath rather than dying on the scrim.
        Positioned.fill(
          child: IgnorePointer(
            child: FadeTransition(
              opacity: curved,
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: _menuBlur, sigmaY: _menuBlur),
                child: const ColoredBox(color: _menuScrim),
              ),
            ),
          ),
        ),
        if (pinned != null)
          Positioned.fromRect(
            rect: anchor,
            child: IgnorePointer(child: pinned!),
          ),
        Positioned(
          left: left,
          top: top,
          width: kKalloMenuWidth,
          child: FadeTransition(
            opacity: curved,
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.92, end: 1).animate(curved),
              alignment: flipped
                  ? (leadingEdge
                        ? Alignment.bottomLeft
                        : Alignment.bottomRight)
                  : (leadingEdge ? Alignment.topLeft : Alignment.topRight),
              // The overlay sits above every Material in the app, and nothing
              // below here introduces one — without this the row labels fall
              // back to the framework's debug style (red monospace on a double
              // YELLOW underline). Transparent restores the inherited text
              // style without painting over the card's surface or shadow.
              child: Material(
                type: MaterialType.transparency,
                child: KalloMenuCard(rows: rows, header: header),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
