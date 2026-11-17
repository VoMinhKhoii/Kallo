/// The open anchored menu, as a widget: its backdrop (blur + scrim, in
/// `anchored_menu_backdrop.dart`), the caller's pinned copy lifting off its
/// own rect (`anchored_menu_pin.dart`), and the card growing out of the
/// lifted rect's corner — all placed by `anchored_menu_geometry.dart`.
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

import 'package:flutter/material.dart';

import '../../../theme/kallo_motion.dart';
import 'anchored_menu_backdrop.dart';
import 'anchored_menu_geometry.dart';
import 'anchored_menu_pin.dart';
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

/// The open menu. [anchor] is a GLOBAL rect in the root overlay's coordinates
/// and [overlaySize] is that overlay's own size — both measured by the caller,
/// because nothing here may reach into the tree the menu was opened from.
///
/// Stateful for ONE reason: the [CurvedAnimation]. The route rebuilds this
/// widget on every frame of its transition, so a curve built in `build` meant a
/// status listener per frame on the route's animation, none ever disposed.
class AnchoredMenuLayer extends StatefulWidget {
  const AnchoredMenuLayer({
    required this.anchor,
    required this.overlaySize,
    required this.animation,
    required this.edge,
    required this.rows,
    this.header,
    this.pinned,
    this.lift = 1,
    this.backdrop = true,
    super.key,
  });

  final Rect anchor;
  final Size overlaySize;
  final Animation<double> animation;
  final KalloMenuEdge edge;
  final List<KalloMenuActionRow> rows;
  final String? header;
  final Widget? pinned;

  /// The scale [pinned] grows to as the menu opens, about the midpoint of the
  /// [edge] side of [anchor] — on the menu's own curve, so the lift, the card
  /// and the blur arrive together and leave together. Ignored without
  /// [pinned]: there is nothing to lift.
  final double lift;

  /// Blur and dim the page behind the card — a context menu's backdrop. A
  /// pull-down ([showKalloAnchoredMenu]'s `backdrop: false`) leaves the page
  /// as it is, as iOS does for a button's menu.
  final bool backdrop;

  @override
  State<AnchoredMenuLayer> createState() => _AnchoredMenuLayerState();
}

class _AnchoredMenuLayerState extends State<AnchoredMenuLayer> {
  late CurvedAnimation _curved = _curve();

  @override
  void didUpdateWidget(AnchoredMenuLayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.animation != oldWidget.animation) {
      _curved.dispose();
      _curved = _curve();
    }
  }

  @override
  void dispose() {
    _curved.dispose();
    super.dispose();
  }

  CurvedAnimation _curve() => CurvedAnimation(
    parent: widget.animation,
    curve: KalloEase.enter,
    reverseCurve: KalloEase.exit,
  );

  @override
  Widget build(BuildContext context) {
    final leadingEdge = widget.edge == KalloMenuEdge.leading;
    final overlaySize = widget.overlaySize;
    final pinned = widget.pinned;
    final height = kalloMenuCardHeight(
      rows: widget.rows.length,
      header: widget.header != null,
    );
    final (:item, :top, :left, :flipped) = placeAnchoredMenu(
      anchor: widget.anchor,
      overlay: overlaySize,
      padding: MediaQuery.paddingOf(context),
      viewInsets: MediaQuery.viewInsetsOf(context),
      menuHeight: height,
      leading: leadingEdge,
      lift: pinned == null ? null : widget.lift,
    );

    return Stack(
      children: [
        if (widget.backdrop)
          Positioned.fill(child: AnchoredMenuBackdrop(opacity: _curved)),
        if (pinned != null)
          AnchoredMenuPin(
            from: widget.anchor,
            to: item,
            animation: _curved,
            child: pinned,
          ),
        Positioned(
          left: left,
          top: top,
          width: kKalloMenuWidth,
          child: FadeTransition(
            opacity: _curved,
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.92, end: 1).animate(_curved),
              alignment:
                  flipped
                      ? (leadingEdge
                          ? Alignment.bottomLeft
                          : Alignment.bottomRight)
                      : (leadingEdge ? Alignment.topLeft : Alignment.topRight),
              // The card is the transitions' `child`, so a tick never rebuilds
              // it. The overlay sits above every Material in the app, and
              // nothing below here introduces one — without this the row
              // labels fall back to the framework's debug style (red monospace
              // on a double YELLOW underline). Transparent restores the
              // inherited text style without painting over the card's surface
              // or shadow.
              child: Material(
                type: MaterialType.transparency,
                child: KalloMenuCard(rows: widget.rows, header: widget.header),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
