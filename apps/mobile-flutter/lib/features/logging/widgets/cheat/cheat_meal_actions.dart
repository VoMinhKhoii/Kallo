import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../services/billing/entitlement_state.dart';
import '../../../../services/billing/feature_lock.dart';
import '../../../circle/widgets/share/show_share_meal_sheet.dart';
import '../../data/logging_models.dart';
import '../actions/confirm_meal_removal.dart';
import '../actions/meal_action_icon_button.dart';
import '../persisted/persisted_meal_share_to_circle_button.dart';

/// The cheat card's action row — [PersistedMealActions] minus everything a
/// cheat occasion cannot do.
///
/// No "log again" (the occasion chips own repeating a cheat), no edit-amounts
/// (that steps grams on item rows a cheat meal does not have). What is left is
/// the two things sharing needs: an offer to specific friends, and the circle
/// toggle.
///
/// Sharing is COPY-only — a cheat meal's numbers are four slider positions,
/// not a dish that halves — so the recipient reopens those sliders and sets
/// their own amounts. `ShareMealSheet` derives that from `meal.isCheat`.
///
/// Sharing with friends is `copy_split`: while the plan lacks it the icon
/// wears a [PremiumDot] and a tap opens the paywall.
class CheatMealActions extends ConsumerWidget {
  const CheatMealActions({super.key, required this.meal, this.onRemove});

  final PersistedMeal meal;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final share = premiumGate(ref, PremiumFeature.copySplit);
    // Reopening the sender's sliders IS the mechanism, so an occasion whose
    // slider payload is gone cannot be offered — the server refuses it.
    final canShare = meal.cheatSliders != null;

    return Row(
      children: [
        if (canShare)
          MealActionIconButton(
            icon: LucideIcons.userPlus300,
            label: 'logging.persistedMealCard.shareWithFriends'.tr(),
            locked: share.locked,
            onTap: share.tap(context, () => showShareMealSheet(context, meal)),
          ),
        const Spacer(),
        // Unconditional, exactly as the precise row does it. With Circle
        // auto-share on, cheat meals are shared on save, so without this
        // toggle the owner had no way to see that — or undo it.
        PersistedMealShareToCircleButton(mealId: meal.id, share: meal.share),
        if (onRemove != null)
          MealActionIconButton(
            icon: LucideIcons.trash2300,
            label: 'logging.remove'.tr(),
            danger: true,
            onTap: () async {
              if (await confirmMealRemoval(context)) {
                if (!context.mounted) return;
                onRemove?.call();
              }
            },
          ),
      ],
    );
  }
}
