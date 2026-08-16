import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/kallo_theme.dart';
import 'share_meal_mode_card.dart';

class ShareMealModeSelector extends StatelessWidget {
  const ShareMealModeSelector({
    super.key,
    required this.mode,
    required this.onChanged,
  });

  final String mode;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: ModeCard(
            label: tr('groups.shareMeal.mode.copy.label'),
            hint: tr('groups.shareMeal.mode.copy.hint'),
            selected: mode == 'copy',
            onTap: () => onChanged('copy'),
          ),
        ),
        const SizedBox(width: KalloSpacing.sp2),
        Expanded(
          child: ModeCard(
            label: tr('groups.shareMeal.mode.split.label'),
            hint: tr('groups.shareMeal.mode.split.hint'),
            selected: mode == 'split',
            onTap: () => onChanged('split'),
          ),
        ),
      ],
    );
  }
}
