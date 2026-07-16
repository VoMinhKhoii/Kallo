import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

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
    final fg = filled ? NhamColors.text : NhamColors.textMuted;
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
            horizontal: NhamSpacing.sp3_5,
            vertical: NhamSpacing.sp1_5,
          ),
          decoration: BoxDecoration(
            color: filled ? NhamColors.accent10 : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.pill),
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
                    color: NhamColors.accentDark,
                  ),
                )
              else
                Icon(icon, size: 13, color: fg),
              const SizedBox(width: NhamSpacing.sp1_5),
              NhamText(
                label,
                variant: NhamTextVariant.chipText,
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.xs,
                ).copyWith(color: fg),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
