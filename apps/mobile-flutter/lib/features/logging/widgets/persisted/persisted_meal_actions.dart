import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../services/billing/entitlement_state.dart';
import '../../../../services/billing/feature_lock.dart';
import '../../../circle/widgets/share/show_share_meal_sheet.dart';
import '../../data/logging_models.dart';
import '../actions/meal_action_icon_button.dart';
import 'persisted_meal_share_to_circle_button.dart';

/// Log again (`relog`) and share with friends (`copy_split`) are gated: while
/// the plan lacks one, its icon wears a [PremiumDot] and a tap opens the
/// paywall instead of the action.
class PersistedMealActions extends ConsumerWidget {
  const PersistedMealActions({super.key, required this.meal, this.onLogAgain});

  final PersistedMeal meal;

  /// Re-log this meal onto the current day — a deterministic server-side copy.
  /// Null hides the "Log again" action. Awaited so the button can show its
  /// pending spinner and guard against double-taps while the copy is in flight.
  final Future<void> Function()? onLogAgain;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final relog = premiumGate(ref, PremiumFeature.relog);
    final share = premiumGate(ref, PremiumFeature.copySplit);
    // Edit and Remove are not here: they live in the card's hold menu
    // (MealHoldMenu), so the row under a meal is only what you do WITH it —
    // log it again, send it, share it to your circle.
    return Row(
      children: [
        if (onLogAgain != null)
          _LogAgainButton(onLogAgain: onLogAgain!, locked: relog.locked),
        if (meal.mealItemGroups.isNotEmpty)
          MealActionIconButton(
            icon: LucideIcons.userPlus300,
            label: 'logging.persistedMealCard.shareWithFriends'.tr(),
            locked: share.locked,
            onTap: share.tap(context, () => showShareMealSheet(context, meal)),
          ),
        const Spacer(),
        PersistedMealShareToCircleButton(mealId: meal.id, share: meal.share),
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
