import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../composer/meal_stepper_button.dart';

/// One row of the edit sheet's grouped cards: a label, then `−  value  +`.
///
/// When the minus would take the dish out rather than shrink it, it shows a
/// trash instead — the same control, honest about what it does next.
class MealEditStepperRow extends StatelessWidget {
  const MealEditStepperRow({
    super.key,
    required this.label,
    required this.value,
    required this.minusLabel,
    required this.plusLabel,
    required this.onMinus,
    required this.onPlus,
    this.minusRemoves = false,
  });

  final String label;
  final String value;

  /// What a screen reader says for each button.
  final String minusLabel;
  final String plusLabel;

  /// Null disables the button.
  final VoidCallback? onMinus;
  final VoidCallback? onPlus;
  final bool minusRemoves;

  static void _tap(VoidCallback? fn) {
    if (fn == null) return;
    HapticFeedback.selectionClick();
    fn();
  }

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 52),
      child: Row(
        children: [
          Expanded(child: Text(label, style: dashBody())),
          Semantics(
            button: true,
            label: minusLabel,
            enabled: onMinus != null,
            // The child's own tap is excluded with its semantics, so the
            // activation has to be handed to VoiceOver here.
            onTap: onMinus == null ? null : () => _tap(onMinus),
            excludeSemantics: true,
            child: MealStepperButton(
              icon: minusRemoves ? LucideIcons.trash2300 : LucideIcons.minus300,
              disabled: onMinus == null,
              onTap: onMinus == null ? null : () => _tap(onMinus),
            ),
          ),
          SizedBox(
            width: 84,
            // Scale down rather than clip: "2.5 large bowls" and four-digit
            // grams both reach past the slot, and a clipped figure reads as a
            // plausible wrong one.
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(value, style: dashValue()),
            ),
          ),
          Semantics(
            button: true,
            label: plusLabel,
            enabled: onPlus != null,
            // The child's own tap is excluded with its semantics, so the
            // activation has to be handed to VoiceOver here.
            onTap: onPlus == null ? null : () => _tap(onPlus),
            excludeSemantics: true,
            child: MealStepperButton(
              icon: LucideIcons.plus300,
              disabled: onPlus == null,
              onTap: onPlus == null ? null : () => _tap(onPlus),
            ),
          ),
        ],
      ),
    );
  }
}
