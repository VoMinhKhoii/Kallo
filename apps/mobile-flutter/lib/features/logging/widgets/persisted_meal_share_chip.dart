import 'package:flutter/material.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

/// A quiet pill chip used for the secondary "Share card" action.
class PersistedMealShareChip extends StatelessWidget {
  const PersistedMealShareChip({
    super.key,
    required this.icon,
    required this.label,
    required this.fg,
    required this.border,
    required this.fill,
    required this.semanticsLabel,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color fg;
  final Color border;
  final Color fill;
  final String semanticsLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticsLabel,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp2_5,
            vertical: NhamSpacing.sp1_5,
          ),
          decoration: BoxDecoration(
            color: fill,
            borderRadius: BorderRadius.circular(NhamRadii.pill),
            border: Border.all(color: border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 13, color: fg),
              const SizedBox(width: NhamSpacing.sp1_5),
              NhamText(
                label,
                variant: NhamTextVariant.chipText,
                style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.xs)
                    .copyWith(color: fg),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
