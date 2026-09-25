import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/badges/premium_chip.dart';
import '../../../../shared/widgets/list/list_row.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/meal_log_mode.dart';

/// One mode in the "select mode" sheet, in the app's shared [ListRow] anatomy.
class MealModeRow extends StatelessWidget {
  const MealModeRow({
    super.key,
    required this.mode,
    required this.selected,
    required this.locked,
    required this.onTap,
  });

  final MealLogMode mode;
  final bool selected;

  /// The user's plan lacks this mode: a [PremiumChip] at the row's right end
  /// (left of the check). The row keeps full ink — no dimming.
  final bool locked;
  final VoidCallback onTap;

  static String _key(MealLogMode mode) => switch (mode) {
    MealLogMode.normal => 'normal',
    MealLogMode.cheat => 'cheat',
    MealLogMode.manual => 'manual',
    MealLogMode.barcode => 'barcode',
  };

  @override
  Widget build(BuildContext context) {
    final key = _key(mode);
    // The tick alone marks the choice. The beige wash this row used to carry
    // was the SAME colour ListRow paints while pressed, so pressing an
    // unselected row made it look chosen for as long as the finger was down —
    // and the wrapper the fill needed for its rounded ends pushed these rows
    // 8pt right of every other row in the app, and of the header's X.
    return ListRow(
      icon: mealModeIcon(mode),
      label: 'logging.modeSelector.$key'.tr(),
      subline: 'logging.modeSelector.${key}Desc'.tr(),
      onTap: onTap,
      trailing:
          locked || selected
              ? Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (locked) const PremiumChip(),
                  if (locked && selected)
                    const SizedBox(width: KalloSpacing.sp2),
                  if (selected)
                    const Icon(
                      LucideIcons.check300,
                      size: KalloIcons.size,
                      color: KalloColors.text,
                    ),
                ],
              )
              : null,
    );
  }
}
