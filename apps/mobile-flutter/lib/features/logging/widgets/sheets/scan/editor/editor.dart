import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';

import '../../../../../../shared/logic/display_format.dart';
import '../../../../../../shared/logic/macro_composition.dart';
import '../../../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../../../shared/widgets/list/list_row.dart';
import '../../../../../../shared/widgets/menu/kallo_pull_down.dart';
import '../../../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../../../shared/widgets/sheet/sheet_capsule_button.dart';
import '../../../../../../shared/widgets/typography/section_header_row.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_colors.dart';
import '../../../../../../theme/kallo_theme.dart';
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
/// Save hands back the edited [ScanFood]; nothing is logged until Add meal on
/// the result. Save waits for a name and the four the log requires (the
/// macronutrients' header says so), and for nothing typed to be malformed or
/// out of range — each such field says why, in red, under its row.
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
        errorText: switch (_draft.issueOf(d.key)) {
          null => null,
          ScanFieldIssue.notANumber => 'logging.scan.notANumber'.tr(),
          ScanFieldIssue.tooHigh => 'logging.scan.tooHigh'.tr(
            namedArgs: {
              'max': formatCount(d.maximum.round(), localeOf(context)),
              'unit': d.unit,
            },
          ),
        },
        filledNote:
            _draft.filledKey == d.key ? 'logging.scan.filledValue'.tr() : null,
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
      onDismiss: widget.onCancel,
      // A level in: a swipe right cancels, as the X does.
      onBack: widget.onCancel,
      header: KalloSheetHeader(
        title:
            (widget.isNew ? 'logging.scan.newFood' : 'logging.scan.edit').tr(),
        onClose: widget.onCancel,
        trailing: SheetCapsuleButton(
          label: 'logging.scan.save'.tr(),
          onTap: _draft.isValid ? () => widget.onDone(_draft.toFood()) : null,
        ),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GroupedListCard(
            children: [
              // Cupertino, not a Material `TextField`: the theme's
              // `inputDecorationTheme` gives every Material field an outlined
              // pill, and `border: none` alone left its `enabledBorder` drawn —
              // a bordered field inside the card's own row.
              CupertinoTextField(
                controller: _draft.name,
                style: dashBody(),
                maxLength: 200,
                decoration: null,
                padding: const EdgeInsets.symmetric(vertical: 16),
                placeholder: 'logging.scan.foodName'.tr(),
                placeholderStyle: dashBody(
                  color: KalloColors.placeholderMuted40,
                ),
                cursorColor: kInk,
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.done,
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
          _Header(
            title: 'logging.scan.macronutrients'.tr(),
            meta: 'logging.scan.requiredToSave'.tr(),
          ),
          GroupedListCard(
            separatorInset: 0,
            children: [
              for (final d in labelMacroDefinitions)
                _field(d, macroKey: macroKeys[d.key]),
            ],
          ),
          _Header(
            title: 'logging.scan.otherNutrients'.tr(),
            meta: 'logging.scan.optional'.tr(),
          ),
          GroupedListCard(
            separatorInset: 0,
            children: [
              for (final d in labelMicronutrientDefinitions) _field(d),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text('logging.scan.blankNote'.tr(), style: dashMeta()),
          ),
        ],
      ),
    );
  }
}

/// A section's header over its card, as the Nutrition page's ("Vitamin ·
/// Limited data"): the title in ink on the left, flush with the card's edge,
/// and what the section asks of you, muted, on the right. The same break
/// above and rhythm below as there.
class _Header extends StatelessWidget {
  const _Header({required this.title, required this.meta});

  final String title;
  final String meta;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(
      top: KalloSpacing.sp6,
      bottom: KalloSpacing.sp3,
    ),
    child: SectionHeaderRow(title: title, meta: meta),
  );
}
