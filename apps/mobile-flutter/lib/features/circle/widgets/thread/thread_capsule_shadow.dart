import 'package:flutter/widgets.dart';

import '../../../../shared/widgets/panes/detail_pane.dart';
import '../../../../shell/nav/pill_nav_surface.dart';
import '../../../../theme/calm_tokens.dart';

/// Redraws, over a thread shown beside the feed, the part of the side
/// capsule's shadow that the thread covers.
///
/// Beside the feed the thread is still a route above the tab shell, so its
/// surface is painted over the capsule's shadow where the shadow reaches into
/// the pane, and the shadow ended in a straight line 8pt from the capsule.
/// The same shadow painted again on top, clipped to the thread, joins the
/// rest of it outside. Pushed over the whole window, the thread covers the
/// capsule too and draws nothing here.
class ThreadCapsuleShadow extends StatelessWidget {
  const ThreadCapsuleShadow({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Stack(
    fit: StackFit.passthrough,
    children: [
      child,
      if (DetailPane.of(context))
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
