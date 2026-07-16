import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../../circle/widgets/share_meal_sheet.dart';

/// The "Share with friends" action — opens the copy/split sheet. Text-only, in
/// the muted action-row voice (web parity with the meal card's action buttons).
class PersistedMealShareWithFriendsButton extends StatelessWidget {
  const PersistedMealShareWithFriendsButton({
    super.key,
    required this.mealId,
  });

  final String mealId;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        showShareMealSheet(context, mealId);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp2_5,
          vertical: NhamSpacing.sp1_5,
        ),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(NhamRadii.pill),
        ),
        child: NhamText(
          tr('logging.persistedMealCard.shareWithFriends'),
          variant: NhamTextVariant.chipText,
          style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.xs)
              .copyWith(color: NhamColors.textMuted),
        ),
      ),
    );
  }
}
