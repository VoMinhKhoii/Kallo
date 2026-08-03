import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/amount_editor_totals.dart';
import '../../logic/logging_spacing.dart';
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
        padding: const EdgeInsets.symmetric(vertical: LoggingSpacing.row),
        child: Row(
          children: [
            Expanded(
              child: Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: dashBody().merge(
                  row.removed
                      ? const TextStyle(
                        decoration: TextDecoration.lineThrough,
                        decorationColor: kInkMuted,
                        color: kInkMuted,
                      )
                      : null,
                ),
              ),
            ),
            const SizedBox(width: NhamSpacing.sp2),
            if (showSteppers) ...[
              MealStepperButton(
                icon: LucideIcons.minus300,
                disabled: minusDisabled,
                onTap: minusDisabled ? null : () => onStep(row.id, -10),
              ),
              const SizedBox(width: 2), // gap-0.5
              SizedBox(
                // Wide enough for `1000g` at Meta 12: the steppers move grams
                // in 10s with no cap, so four digits is reachable and a
                // wrapped value would grow the whole editor row.
                //
                // It SCALES DOWN past that rather than clipping. Clipping a
                // number is the worst failure available: `1200g` cut to the
                // cell reads as a smaller, entirely plausible amount, and the
                // user has no way to see it is wrong.
                width: 44,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    '${grams.round()}g',
                    maxLines: 1,
                    softWrap: false,
                    textAlign: TextAlign.center,
                    style: dashMeta(color: kInk, tabular: true),
                  ),
                ),
              ),
              const SizedBox(width: 2),
              MealStepperButton(
                icon: LucideIcons.plus300,
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

/// The per-row X toggle — the shared logging hit target around the shared
/// glyph size, tinted danger when the row is flagged for removal.
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
          width: LoggingIcons.hit,
          height: LoggingIcons.hit,
          child: Center(
            child: Icon(
              LucideIcons.x300,
              size: LoggingIcons.size,
              color: removed ? NhamColors.danger : NhamColors.text,
            ),
          ),
        ),
      ),
    );
  }
}
