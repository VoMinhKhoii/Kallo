import 'package:flutter/material.dart';

import '../../theme/kallo_theme.dart';
import 'app_header_back_button.dart';

/// In-flow app header (native pass, 2026-08-31 — the hamburger is retired
/// with the drawer).
///
/// Left slot: a back chevron when [onBack] is given (pushed screens like
/// Settings), a custom [leading] widget (the dashboard's profile avatar), or
/// a 44×44 spacer. A flexible center [child] slot (the dashboard greeting,
/// the logging date chip), and a right slot mirroring the left so the center
/// stays centered.
class AppHeader extends StatelessWidget {
  const AppHeader({
    this.child,
    this.onBack,
    this.leading,
    this.trailing,
    super.key,
  });

  /// Center slot content.
  final Widget? child;

  /// When non-null, a back chevron fills the leading slot (pushed screens).
  final VoidCallback? onBack;

  /// Custom leading widget when there is no [onBack] — the dashboard's
  /// profile-avatar button. Falls back to a 44×44 spacer.
  final Widget? leading;

  /// Optional right-slot content (e.g. the nutrition date toggle). When null a
  /// 44×44 spacer mirrors the leading slot so [child] stays centered.
  final Widget? trailing;

  // Square hit target for the side slots.
  static const double _hit = 44;

  /// Public alias of the slot size for leading/trailing widgets built
  /// elsewhere (the avatar button sizes itself to match).
  static const double slotSize = _hit;

  @override
  Widget build(BuildContext context) {
    final Widget leading = onBack != null
        ? AppHeaderBackButton(onBack: onBack!)
        : (this.leading ?? const SizedBox(width: _hit, height: _hit));

    return Padding(
      padding: const EdgeInsets.only(bottom: KalloSpacing.sp1),
      child: Row(
        children: [
          leading,
          Expanded(
            child: Align(
              alignment: Alignment.center,
              child: child ?? const SizedBox.shrink(),
            ),
          ),
          // Trailing slot, or a spacer that mirrors the leading slot so the
          // center stays centered when there's nothing on the right.
          trailing ?? const SizedBox(width: _hit, height: _hit),
        ],
      ),
    );
  }
}

