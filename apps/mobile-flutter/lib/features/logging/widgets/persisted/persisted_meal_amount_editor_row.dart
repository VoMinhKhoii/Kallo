import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/nham_text.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/amount_editor_totals.dart';
import '../../logic/meal_utils.dart';
import '../meal_stepper_button.dart';

/// One ingredient row in the amount editor: name, ±10g steppers with a tabular
/// grams readout, and an X toggle that flags the row for removal (opacity 0.40 +
/// strikethrough, steppers hidden, undoable). Ported from the web
/// `components/logging/feed/persisted/amount-editor-row.tsx`.
class PersistedMealAmountEditorRow extends StatelessWidget {
  const PersistedMealAmountEditorRow({
    super.key,
    required this.name,
    required this.row,
    required this.onStep,
    required this.onToggleRemove,
  });

  final String name;
  final EditableIngredientRow row;
  final void Function(String id, double delta) onStep;
  final void Function(String id) onToggleRemove;

  @override
  Widget build(BuildContext context) {
    final grams = row.grams;
    final showSteppers = grams != null && !row.removed;
    final minusDisabled = grams != null && grams <= minDishGrams;

    return Opacity(
      opacity: row.removed ? 0.4 : 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8), // py-2
        child: Row(
          children: [
            Expanded(
              child: NhamText(
                name,
                variant: NhamTextVariant.itemName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: row.removed
                    ? const TextStyle(
                        decoration: TextDecoration.lineThrough,
                        decorationColor: kInkMuted,
                        color: kInkMuted,
                      )
                    : null,
              ),
            ),
            const SizedBox(width: NhamSpacing.sp2),
            if (showSteppers) ...[
              MealStepperButton(
                icon: LucideIcons.minus,
                disabled: minusDisabled,
                onTap: minusDisabled ? null : () => onStep(row.id, -10),
              ),
              const SizedBox(width: 2), // gap-0.5
              SizedBox(
                width: 36,
                child: NhamText(
                  '${grams.round()}g',
                  variant: NhamTextVariant.numStrong,
                  textAlign: TextAlign.center,
                  style: dashMeta(color: kInk, tabular: true),
                ),
              ),
              const SizedBox(width: 2),
              MealStepperButton(
                icon: LucideIcons.plus,
                onTap: () => onStep(row.id, 10),
              ),
              const SizedBox(width: 2),
            ],
            _RemoveToggle(
              removed: row.removed,
              label: 'logging.persistedMealCard.removeRow'.tr(
                namedArgs: {'name': name},
              ),
              onTap: () => onToggleRemove(row.id),
            ),
          ],
        ),
      ),
    );
  }
}

/// The per-row X toggle — a 40pt tap target around a 16pt lucide X, tinted
/// danger when the row is flagged for removal.
class _RemoveToggle extends StatelessWidget {
  const _RemoveToggle({
    required this.removed,
    required this.label,
    required this.onTap,
  });

  final bool removed;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      toggled: removed,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Center(
            child: Icon(
              LucideIcons.x,
              size: 16,
              color: removed ? NhamColors.danger : NhamColors.textMuted60,
            ),
          ),
        ),
      ),
    );
  }
}
