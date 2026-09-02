import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/calm_tokens.dart';

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
            horizontal: KalloSpacing.sp3,
            vertical: KalloSpacing.sp2_5,
          ),
          decoration: BoxDecoration(
            color: selected ? KalloColors.accent10 : KalloColors.elev,
            borderRadius: BorderRadius.circular(KalloRadii.lg),
            border: Border.all(
              color: selected ? KalloColors.accent50 : KalloColors.borderSoft,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: dashBody(),
              ),
              const SizedBox(height: 2),
              Text(
                hint,
                style: dashMeta(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
