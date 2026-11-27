import 'package:flutter/widgets.dart';

import '../../../theme/calm_tokens.dart';
import '../pill_nav_surface.dart';

/// Redraws, over a page painted above the tab shell, the part of the side
/// capsule's shadow that the page covers.
///
/// A page beside the control column is still a route above the shell, so its
/// surface is painted over the capsule's shadow where the shadow reaches past
/// the column, and the shadow ended in a straight line 8pt from the capsule.
/// The same shadow painted again on top, clipped to the page, joins the rest
/// of it outside. The Circle thread beside its feed and the Log page beside
/// the column both wear it; [show] is false where the page covers the
/// capsule too, and nothing is drawn.
class NavColumnShadow extends StatelessWidget {
  const NavColumnShadow({super.key, required this.show, required this.child});

  final bool show;
  final Widget child;

  @override
  Widget build(BuildContext context) => Stack(
    fit: StackFit.passthrough,
    children: [
      child,
      if (show)
        Positioned.fill(
          child: IgnorePointer(
            child: ClipRect(
              child: CompositedTransformFollower(
                link: navColumnCapsuleLink,
                showWhenUnlinked: false,
                child: const CustomPaint(painter: _CapsuleShadowPainter()),
              ),
            ),
          ),
        ),
    ],
  );
}

class _CapsuleShadowPainter extends CustomPainter {
  const _CapsuleShadowPainter();

  static final _shadow = BoxDecoration(
    borderRadius: BorderRadius.circular(kNavColumnRadius),
    boxShadow: kNavShadows,
  );

  @override
  void paint(Canvas canvas, Size size) {
    // The follower puts this canvas's origin on the capsule's top-left.
    final capsule = navColumnCapsuleLink.leaderSize;
    if (capsule == null) return;
    final painter = _shadow.createBoxPainter();
    painter.paint(canvas, Offset.zero, ImageConfiguration(size: capsule));
    painter.dispose();
  }

  @override
  bool shouldRepaint(_CapsuleShadowPainter oldDelegate) => false;
}
