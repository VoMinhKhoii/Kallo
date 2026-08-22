import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// The switch names the scope it moves TO, and the arrow points that way:
/// complete days sit to the left of logged days.
class ScopeSwitch extends StatelessWidget {
  const ScopeSwitch({
    super.key,
    required this.onComplete,
    required this.onTap,
  });

  final bool onComplete;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = tr(onComplete
        ? 'nutrition.rhythm.loggedDays'
        : 'nutrition.rhythm.completeDays');
    return Semantics(
      button: true,
      label: label,
      // `excludeSemantics` drops the child's own nodes, so without `onTap`
      // here the node announces "button" and exposes no tap action.
      onTap: onTap,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          // Text height plus sp1 either side is well under the 44px minimum
          // for a primary control; the padding stays, the hit area grows.
          constraints: const BoxConstraints(minHeight: 44),
          alignment: Alignment.centerRight,
          padding: const EdgeInsets.symmetric(
            horizontal: KalloSpacing.sp2,
            vertical: KalloSpacing.sp1,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!onComplete) ...[
                const Icon(LucideIcons.arrowLeft300, size: 14,
                    color: kInkMuted),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: dashMeta(color: kInkMuted)
                    .copyWith(fontWeight: FontWeight.w500),
              ),
              if (onComplete) ...[
                const SizedBox(width: 6),
                const Icon(LucideIcons.arrowRight300, size: 14,
                    color: kInkMuted),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

