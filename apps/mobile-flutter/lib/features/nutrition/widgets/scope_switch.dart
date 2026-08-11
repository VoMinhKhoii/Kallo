import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';

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
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp2,
            vertical: NhamSpacing.sp1,
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

