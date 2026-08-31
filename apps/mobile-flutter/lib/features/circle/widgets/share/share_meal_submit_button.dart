import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/kallo_typography.dart';

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
          constraints: const BoxConstraints(minHeight: 50),
          padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp3),
          // In-app primary: beige wash + ink, fully rounded (the umber fill
          // predated the button retirement — missed on the first native pass).
          decoration: BoxDecoration(
            color: KalloColors.btnPrimarySoft,
            borderRadius: BorderRadius.circular(KalloRadii.button),
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
                    color: KalloColors.text,
                  ),
                )
              else
                const Icon(
                  LucideIcons.users300,
                  size: 16,
                  color: KalloColors.text,
                ),
              const SizedBox(width: KalloSpacing.sp2),
              Text(
                label,
                style: KalloTextStyles.sansMedium(
                  fontSize: KalloFontSize.sm,
                ).copyWith(color: KalloColors.text),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
