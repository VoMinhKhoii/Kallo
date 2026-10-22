import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';
import 'aurora_glow.dart';

/// Full-bleed cream screen with safe-area insets.
///
/// Defaults to applying top + bottom safe-area padding; pass [top]/[bottom] to
/// opt out of an edge. No web counterpart file — the web screen frame is CSS
/// layout, not a component.
///
/// Shell-branch screens pass `bottom: false`: under `extendBody` the floating
/// pill nav reports its whole height as bottom padding, and consuming it here
/// pins the page above the pill. Their scroll views read that same
/// `MediaQuery.padding.bottom` as their own tail inset instead, so content
/// slides under the bar. Pushed routes (Settings, Log, sheets' hosts) keep the
/// default and clear the home indicator.
class Screen extends StatelessWidget {
  const Screen({
    super.key,
    required this.child,
    this.top = true,
    this.bottom = true,
    this.glow = false,
  });

  final Widget child;
  final bool top;
  final bool bottom;

  /// A main page (Today, Log, Nutrition, Circle, Settings): paints the
  /// [AuroraGlow] behind its top in Aurora. Nothing in Light or Dark.
  final bool glow;

  @override
  Widget build(BuildContext context) {
    final Widget page = SafeArea(
      top: top,
      bottom: bottom,
      // Tap anywhere on empty surface to dismiss the keyboard — the native
      // mobile expectation. Interactive descendants (buttons, fields) win the
      // gesture arena for their own taps, so only "background" taps drop focus.
      // `opaque` makes the whole cream area hittable; `onTap` claims nothing
      // that would interfere with scrolling.
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
        // Transparent Material ancestor so TextField/InkWell descendants
        // resolve their Material lookup without painting over the cream
        // surface.
        child: Material(type: MaterialType.transparency, child: child),
      ),
    );
    return ColoredBox(
      color: KalloColors.surface,
      child: glow ? AuroraGlow(child: page) : page,
    );
  }
}
