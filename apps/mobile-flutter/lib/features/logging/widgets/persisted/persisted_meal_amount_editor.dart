import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/logging_models.dart';
import '../../logic/amount_editor_totals.dart';
import '../../logic/format.dart';
import '../../logic/logging_spacing.dart';
import '../../logic/meal_utils.dart';
import 'persisted_meal_amount_editor_buttons.dart';
import 'persisted_meal_amount_editor_row.dart';

/// Persist a set of amount edits: gram overrides keyed by `meal_items` id, and
/// per-row removals. Resolves on success; throws so the editor can stay open.
typedef AmountEditSave =
    Future<void> Function({
      required List<Map<String, dynamic>> edits,
      required List<String> removeIds,
    });

/// The saved-meal amount editor — swaps in place for the read-only expanded body.
/// Per-ingredient ±10g steppers, remove-toggle with strikethrough, live-scaling
/// totals, and Save/Cancel. Ported from the web
/// `components/logging/feed/persisted/meal-amount-editor.tsx`.
class PersistedMealAmountEditor extends StatefulWidget {
  const PersistedMealAmountEditor({
    super.key,
    required this.meal,
    required this.onCancel,
    required this.onSave,
  });

  final PersistedMeal meal;
  final VoidCallback onCancel;
  final AmountEditSave onSave;

  @override
  State<PersistedMealAmountEditor> createState() =>
      _PersistedMealAmountEditorState();
}

class _PersistedMealAmountEditorState extends State<PersistedMealAmountEditor> {
  late final List<PersistedIngredient> _ingredients =
      widget.meal.mealItemGroups.expand((g) => g.ingredients).toList();
  late final Map<String, double?> _initialGrams = {
    for (final ing in _ingredients) ing.id: ing.estimatedGrams,
  };
  late final Map<String, String> _names = {
    for (final ing in _ingredients) ing.id: ing.ingredientName,
  };
  late List<EditableIngredientRow> _rows = [
    for (final ing in _ingredients)
      EditableIngredientRow(
        id: ing.id,
        grams: ing.estimatedGrams,
        removed: false,
      ),
  ];

  bool _saving = false;

  void _step(String id, double delta) {
    if (_saving) return;
    setState(() {
      _rows = [
        for (final r in _rows)
          (r.id == id && r.grams != null)
              ? r.copyWith(
                grams: (r.grams! + delta).clamp(minDishGrams, double.infinity),
              )
              : r,
      ];
    });
  }

  void _toggleRemove(String id) {
    if (_saving) return;
    setState(() {
      _rows = [
        for (final r in _rows) r.id == id ? r.copyWith(removed: !r.removed) : r,
      ];
    });
  }

  Future<void> _handleSave() async {
    if (_saving) return;
    final removeIds = [
      for (final r in _rows)
        if (r.removed) r.id,
    ];
    final edits = <Map<String, dynamic>>[
      for (final r in _rows)
        if (!r.removed &&
            r.grams != null &&
            _initialGrams[r.id] != null &&
            r.grams != _initialGrams[r.id])
          {'id': r.id, 'newGrams': r.grams},
    ];
    if (removeIds.isEmpty && edits.isEmpty) {
      widget.onCancel();
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.onSave(edits: edits, removeIds: removeIds);
      widget.onCancel();
    } catch (_) {
      // The error toast is raised by the caller; keep the editor open to retry.
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final totals = computeEditedTotals(_ingredients, _rows);
    // Removing the last row leaves an empty meal — block Save (remove the whole
    // meal instead). Mirrors the web's canSave gate.
    final canSave = _rows.any((r) => !r.removed);

    // Same rhythm as the read-only expanded body it replaces, so toggling
    // Edit changes the controls in the rows and nothing else.
    return Padding(
      padding: const EdgeInsets.only(top: LoggingSpacing.section),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Divider(height: 1, thickness: 1, color: KalloColors.borderFaint),
          const SizedBox(height: LoggingSpacing.section),
          for (final row in _rows)
            PersistedMealAmountEditorRow(
              name: _names[row.id] ?? '',
              row: row,
              onStep: _step,
              onToggleRemove: _toggleRemove,
            ),
          const SizedBox(height: LoggingSpacing.section),
          const Divider(height: 1, thickness: 1, color: KalloColors.borderFaint),
          const SizedBox(height: LoggingSpacing.section),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'logging.persistedMealCard.total'.tr(), style: dashBody(tabular: true),),
              Row(
                children: [
                  Text(
                    'P: ${fmtG(totals.proteinG)}  C: ${fmtG(totals.carbohydrateG)}  F: ${fmtG(totals.fatG)}', style: dashMeta(tabular: true),),
                  const SizedBox(width: KalloSpacing.sp4), // gap-4
                  Text(
                    fmtKcal(
                      totals.caloriesKcal,
                      locale: localeOf(context),
                    ), style: dashValue(),),
                ],
              ),
            ],
          ),
          const SizedBox(height: LoggingSpacing.section),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              AmountEditorCancelButton(onTap: _saving ? null : widget.onCancel),
              const SizedBox(width: KalloSpacing.sp2),
              AmountEditorSaveButton(
                saving: _saving,
                enabled: canSave,
                onTap: (_saving || !canSave) ? null : _handleSave,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
