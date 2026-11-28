import 'package:flutter/widgets.dart';

import '../../../shell/window/window_layout.dart';

/// Clears the status bar, or the window's rounded top corners where the
/// system reserves no inset, for everything the paywall shows.
///
/// Its own widget rather than one [SafeArea] around the whole screen: beside
/// the fold the start preview stands in the far pane, outside it, so the
/// preview sits exactly where every other signed-out screen puts it.
class PaywallTopInset extends StatelessWidget {
  const PaywallTopInset({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) => SafeArea(
    left: false,
    right: false,
    bottom: false,
    minimum: EdgeInsets.only(top: WindowLayout.of(context).topCornerGap),
    child: child,
  );
}
