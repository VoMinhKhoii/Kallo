import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../../shared/logic/macro_composition.dart';
import '../../../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../../../shared/widgets/list/list_row.dart';
import '../../../../../../shared/widgets/menu/kallo_pull_down.dart';
import '../../../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../../../shared/widgets/sheet/sheet_capsule_button.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../logic/label/nutrients.dart';
import '../../../../logic/label/review.dart';
import '../../../../logic/scan/amount.dart';
import '../../../../logic/scan/food.dart';
import 'draft.dart';
import '../panel/panel.dart';
import 'field.dart';

/// Edit everything about a food — its name, what its values are per, calories,
/// the three macros and every nutrient the app knows (all 24, so adding one is
/// scroll-and-type, never a picker) — or type one from scratch ("New food").
///
/// Done hands back the edited [ScanFood]; nothing is saved until Add meal on
/// the result. Done waits for a name and the four the log requires.
class ScanFoodEditor extends StatefulWidget {
  const ScanFoodEditor({
    super.key,
    required this.food,
    required this.isNew,
    required this.onDone,
    required this.onCancel,
  });

  final ScanFood food;

  /// "New food" (Enter manually) rather than "Edit".
  final bool isNew;
  final ValueChanged<ScanFood> onDone;
  final VoidCallback onCancel;

  @override
  State<ScanFoodEditor> createState() => _ScanFoodEditorState();
}

class _ScanFoodEditorState extends State<ScanFoodEditor> {
  late final _draft = ScanEditorDraft(widget.food)
    ..listen(() => setState(() {}));

  @override
  void dispose() {
    _draft.dispose();
    super.dispose();
  }

  static String _basisLabel(ScanBasis b) =>
      b.unit == 'serving'
          ? '${formatLabelNumber(b.amount)} ${'logging.scan.servingWord'.plural(b.amount.round())}'
          : formatSize(b.amount, b.unit);

  Widget _field(LabelNutrientDefinition d, {String? macroKey}) =>
      ScanEditorField(
        label: 'logging.labelScan.nutrients.${d.labelKey}'.tr(),
        controller: _draft.fields[d.key]!,
        unit: d.unit,
        icon: macroKey == null ? null : kMacroIcons[macroKey],
        iconColor: macroKey == null ? null : kCompositionColors[macroKey],
        error: _draft.hasError(d.key),
      );

  @override
  Widget build(BuildContext context) {
    const macroKeys = {
      'proteinGrams': 'protein',
      'carbsGrams': 'carbohydrate',
      'fatGrams': 'fat',
    };
    return ScanPanel(
      height: ScanPanelHeight.full,
      header: KalloSheetHeader(
        title:
            (widget.isNew ? 'logging.scan.newFood' : 'logging.scan.edit').tr(),
        onClose: widget.onCancel,
        trailing: SheetCapsuleButton(
          label: 'logging.scan.done'.tr(),
          onTap: _draft.isValid ? () => widget.onDone(_draft.toFood()) : null,
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GroupedListCard(
            children: [
              TextField(
                controller: _draft.name,
                style: dashBody(),
                maxLength: 200,
                decoration: InputDecoration(
                  hintText: 'logging.scan.foodName'.tr(),
                  border: InputBorder.none,
                  counterText: '',
                  contentPadding: const EdgeInsets.symmetric(vertical: 16),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          GroupedListCard(
            separatorInset: 0,
            children: [
              ListRow(
                label: 'logging.scan.valuesPer'.tr(),
                trailing: KalloPullDown<ScanBasis>(
                  value: _draft.basis,
                  display: _basisLabel(_draft.basis),
                  options: [
                    for (final b in _draft.bases)
                      KalloPullDownOption(value: b, label: _basisLabel(b)),
                  ],
                  onChanged: (b) => setState(() => _draft.basis = b),
                ),
              ),
            ],
          ),
          _Caption('logging.scan.nutrition'.tr()),
          GroupedListCard(
            separatorInset: 0,
            children: [
              for (final d in labelMacroDefinitions)
                _field(d, macroKey: macroKeys[d.key]),
            ],
          ),
          _Caption('logging.scan.otherNutrients'.tr()),
          GroupedListCard(
            separatorInset: 0,
            children: [
              for (final d in labelMicronutrientDefinitions) _field(d),
            ],
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Text('logging.scan.blankNote'.tr(), style: dashMeta()),
          ),
        ],
      ),
    );
  }
}

class _Caption extends StatelessWidget {
  const _Caption(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 20, 16, 6),
    child: Text(text, style: kGroupLabel()),
  );
}
