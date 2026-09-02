import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/calm_tokens.dart';

class InviteAction extends StatelessWidget {
  const InviteAction({
    required this.icon,
    required this.label,
    required this.onTap,
    required this.filled,
    this.loading = false,
    super.key,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool filled;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final fg = filled ? KalloColors.text : KalloColors.textMuted;
    return Opacity(
      opacity: onTap == null ? 0.6 : 1,
      child: GestureDetector(
        onTap:
            onTap == null
                ? null
                : () {
                  HapticFeedback.lightImpact();
                  onTap!();
                },
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: KalloSpacing.sp3_5,
            vertical: KalloSpacing.sp1_5,
          ),
          decoration: BoxDecoration(
            color: filled ? KalloColors.accent10 : Colors.transparent,
            borderRadius: BorderRadius.circular(KalloRadii.pill),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (loading)
                const SizedBox(
                  width: 13,
                  height: 13,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: KalloColors.accentDark,
                  ),
                )
              else
                Icon(icon, size: 13, color: fg),
              const SizedBox(width: KalloSpacing.sp1_5),
              Text(
                label,
                style: dashMeta(color: fg, weight: FontWeight.w500),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
