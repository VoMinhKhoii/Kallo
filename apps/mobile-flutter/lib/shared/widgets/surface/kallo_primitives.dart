import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

// Screen and Button live in their own files (size gate); re-exported so the
// single primitives import still reaches every primitive.
export 'kallo_button.dart';
export 'kallo_screen.dart';

/// White card separating by surface alone on the `#F8F7F4` canvas — radius
/// 22, NO border, NO shadow (native pass, 2026-08-31; shadows are reserved
/// for true elevation: sheets, menus, the pill nav).
class KalloCard extends StatelessWidget {
  const KalloCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.symmetric(
      horizontal: KalloSpacing.sp4,
      vertical: KalloSpacing.sp3,
    ),
    this.borderRadius,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(KalloRadii.card);
    return Container(
      padding: padding,
      decoration: BoxDecoration(color: KalloColors.elev, borderRadius: radius),
      child: child,
    );
  }
}

/// Button visual variants (native pass, 2026-08-31).
///
/// [cta] — black & white: auth and paywall (sign in, start free trial), and
/// the one action under a `KalloSurfaceState` (retry, log a meal, go home).
/// [primary] — beige `#F0EAE0` + ink: every in-app primary (save, share…).
/// [secondary] — quiet: white + hairline.
/// [danger] / [ghost] — unchanged roles.
