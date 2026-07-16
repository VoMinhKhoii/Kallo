import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

class ModeCard extends StatelessWidget {
  const ModeCard({
    required this.label,
    required this.hint,
    required this.selected,
    required this.onTap,
    super.key,
  });

  final String label;
  final String hint;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp3,
            vertical: NhamSpacing.sp2_5,
          ),
          decoration: BoxDecoration(
            color: selected ? NhamColors.accent10 : NhamColors.elev,
            borderRadius: BorderRadius.circular(NhamRadii.lg),
            border: Border.all(
              color: selected ? NhamColors.accent50 : NhamColors.borderSoft,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.detail,
                ).copyWith(color: NhamColors.text),
              ),
              const SizedBox(height: 2),
              Text(
                hint,
                style: NhamTextStyles.sansRegular(
                  fontSize: NhamFontSize.xxs,
                ).copyWith(color: NhamColors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
