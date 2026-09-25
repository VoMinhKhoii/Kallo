import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';

/// The icon-only form of [PremiumChip]: a 7pt blue dot with a 2pt white ring
/// on the top-right corner of [child] (an icon button's glyph), for buttons too
/// small to carry a chip. Same approved spec as web's `PremiumDot`.
///
/// With [show] false it renders [child] untouched, so a call site can wrap its
/// button once and let the entitlement decide.
class PremiumDot extends StatelessWidget {
  const PremiumDot({super.key, required this.show, required this.child});

  final bool show;
  final Widget child;

  /// Dot plus its ring on both sides.
  static const double _outer = 7 + 2 * 2;

  @override
  Widget build(BuildContext context) {
    if (!show) return child;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        child,
        // Nudged out by the ring's width so the blue sits ON the glyph's
        // corner rather than inside its box.
        Positioned(
          top: -2,
          right: -2,
          child: IgnorePointer(
            child: Container(
              key: const ValueKey('premium-dot'),
              width: _outer,
              height: _outer,
              decoration: BoxDecoration(
                color: KalloColors.premiumDot,
                shape: BoxShape.circle,
                border: Border.all(color: KalloColors.elev, width: 2),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
