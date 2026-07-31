import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

class SubmitButton extends StatelessWidget {
  const SubmitButton({
    required this.label,
    required this.enabled,
    required this.loading,
    required this.onTap,
    super.key,
  });

  final String label;
  final bool enabled;
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        child: Container(
          width: double.infinity,
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp3),
          decoration: BoxDecoration(
            color: NhamColors.btn,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (loading)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              else
                const Icon(LucideIcons.users300, size: 16, color: Colors.white),
              const SizedBox(width: NhamSpacing.sp2),
              Text(
                label,
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.sm,
                ).copyWith(color: Colors.white),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
