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
import 'persisted_meal_share_to_circle_button.dart';

/// Log again (`relog`) and share with friends (`copy_split`) are gated: while
/// the plan lacks one, its icon wears a [PremiumDot] and a tap opens the
/// paywall instead of the action.
class PersistedMealActions extends ConsumerWidget {
  const PersistedMealActions({
    super.key,
    required this.meal,
    required this.onRemove,
    this.onEditAmounts,
    this.onLogAgain,
  });

  final PersistedMeal meal;
  final VoidCallback? onRemove;

  /// Opens the in-place amount editor. Null hides the "Edit amounts" action
  /// (the meal has no gram-bearing ingredient to step).
  final VoidCallback? onEditAmounts;

  /// Re-log this meal onto the current day — a deterministic server-side copy.
  /// Null hides the "Log again" action. Awaited so the button can show its
  /// pending spinner and guard against double-taps while the copy is in flight.
  final Future<void> Function()? onLogAgain;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final relog = premiumGate(ref, PremiumFeature.relog);
    final share = premiumGate(ref, PremiumFeature.copySplit);
    // Web action order (meal-card-action-bar.tsx): logAgain, [refine — not on
    // mobile], editAmounts, shareWithFriends. The right-side circle-share +
    // remove arrangement is mobile's own and stays put.
    return Row(
      children: [
        if (onLogAgain != null)
          _LogAgainButton(onLogAgain: onLogAgain!, locked: relog.locked),
        if (onEditAmounts != null)
          MealActionIconButton(
            icon: LucideIcons.slidersHorizontal300,
            label: 'logging.persistedMealCard.editAmounts'.tr(),
            onTap: onEditAmounts,
          ),
        if (meal.mealItemGroups.isNotEmpty)
          MealActionIconButton(
            icon: LucideIcons.userPlus300,
            label: 'logging.persistedMealCard.shareWithFriends'.tr(),
            locked: share.locked,
            onTap: share.tap(context, () => showShareMealSheet(context, meal)),
          ),
        const Spacer(),
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

/// The left-most "Log again" action (web `RotateCcw`). Holds its own pending
/// flag so it shows the shared spinner and ignores repeat taps while the
/// duplicate is in flight (MealActionIconButton also disables its tap when
/// pending, so the guard is doubly enforced).
class _LogAgainButton extends StatefulWidget {
  const _LogAgainButton({required this.onLogAgain, required this.locked});

  final Future<void> Function() onLogAgain;

  /// The plan lacks `relog`: the glyph wears the dot and a tap opens the
  /// paywall instead of duplicating.
  final bool locked;

  @override
  State<_LogAgainButton> createState() => _LogAgainButtonState();
}

class _LogAgainButtonState extends State<_LogAgainButton> {
  bool _pending = false;

  Future<void> _run() async {
    if (_pending) return;
    setState(() => _pending = true);
    try {
      await widget.onLogAgain();
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return MealActionIconButton(
      icon: LucideIcons.rotateCcw300,
      label: 'logging.persistedMealCard.logAgain'.tr(),
      pending: _pending,
      locked: widget.locked,
      onTap: PremiumGate(locked: widget.locked).tap(context, _run),
    );
  }
}
