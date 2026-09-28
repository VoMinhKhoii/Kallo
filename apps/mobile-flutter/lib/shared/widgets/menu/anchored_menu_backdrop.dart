import 'dart:ui';

import 'package:flutter/widgets.dart';

/// The scrim under the blur — ink at 20%, well short of the dialog scrim's
/// black/50, and INK rather than pure black so the blurred canvas keeps its
/// hue (`kallo_colors.dart`: a ramp fading toward the wrong neutral is a
/// visible seam). A menu is an extension of the page it hangs off, so that
/// page stays readable; a dialog is not, and dims it properly. The value
/// `circle_add_menu.dart` shipped.
const Color _menuScrim = Color(0x33141413);

const double _menuBlur = 8; // how far the page recedes behind the card

/// What an open context menu does to the page behind it: blurs it a little
/// and lays [_menuScrim] over it, fading in with the card ([opacity]).
///
/// Its own widget because it is the one part of the open menu a caller can
/// turn off: a pull-down leaves the page as it is (`showKalloAnchoredMenu`'s
/// `backdrop`). Decorative only — [IgnorePointer], so the dismiss tap reaches
/// the route's barrier underneath rather than dying on the scrim.
class AnchoredMenuBackdrop extends StatelessWidget {
  const AnchoredMenuBackdrop({required this.opacity, super.key});

  final Animation<double> opacity;

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: FadeTransition(
      opacity: opacity,
      // The blur is the transition's `child`: a tick repaints it.
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: _menuBlur, sigmaY: _menuBlur),
        child: const ColoredBox(color: _menuScrim),
      ),
    ),
  );
}
