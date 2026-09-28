import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../../../shared/widgets/sheet/kallo_sheet_sub_header.dart';
import '../../../../../../shared/widgets/sheet/sheet_capsule_button.dart';
import '../../../../../../shared/widgets/surface/kallo_button.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_colors.dart';
import '../../../../logic/label/nutrients.dart';
import '../../../../logic/scan/amount.dart';
import '../../../../logic/scan/food.dart';
import '../panel/panel.dart';
import 'other_nutrients.dart';
import 'body.dart';
import 'header.dart';

/// A scan result over the frozen camera: its title, Edit, the result body, and
/// Add meal. "Other nutrients" slides in as a second level of the same panel,
/// the product and macros kept on top.
class ScanResultPanel extends StatefulWidget {
  const ScanResultPanel({
    super.key,
    required this.food,
    required this.amount,
    required this.onAmount,
    required this.ctaLabel,
    required this.saving,
    required this.onClose,
    required this.onEdit,
    required this.onAdd,
    this.errorText,
  });

  final ScanFood food;

  /// How much is being logged — the screen's, so it survives an edit.
  final ScanAmount amount;
  final ValueChanged<ScanAmount> onAmount;

  /// "Add meal", or "Add to meal" when the composer asked for the product.
  final String ctaLabel;
  final bool saving;
  final String? errorText;

  /// Back to scanning.
  final VoidCallback onClose;

  /// Gated like label scan; the gate's tap handler.
  final VoidCallback? onEdit;
  final ValueChanged<double> onAdd;

  @override
  State<ScanResultPanel> createState() => _ScanResultPanelState();
}

class _ScanResultPanelState extends State<ScanResultPanel> {
  bool _others = false;

  ScanAmount get _amount => widget.amount;

  /// The sheet's title says where the numbers came from.
  String get _title =>
      switch (widget.food.source) {
        ScanFoodSource.barcode => 'logging.scan.barcodeTitle',
        ScanFoodSource.label => 'logging.scan.labelTitle',
        ScanFoodSource.manual => 'logging.scan.newFood',
      }.tr();

  /// Under the name: the brand, or that the numbers are the label's.
  String? get _subtitle =>
      widget.food.source == ScanFoodSource.label
          ? 'logging.scan.fromLabel'.tr()
          : widget.food.brand;

  String _amountCaption(double resolved) {
    final unit = widget.food.unit;
    String withSize(int n, String wordKey) =>
        unit == 'serving'
            ? '$n ${wordKey.plural(n)}'
            : '$n ${wordKey.plural(n)} · ${formatSize(resolved, unit)}';
    final amount = switch (_amount.portion) {
      ScanPortion.serving => withSize(
        _amount.servings,
        'logging.scan.servingWord',
      ),
      ScanPortion.pack => withSize(_amount.packs, 'logging.scan.packWord'),
      ScanPortion.custom =>
        unit == 'serving'
            ? withSize(_amount.custom.round(), 'logging.scan.servingWord')
            : formatSize(resolved, unit),
    };
    return 'logging.scan.inAmount'.tr(namedArgs: {'amount': amount});
  }

  @override
  Widget build(BuildContext context) {
    final food = widget.food;
    final resolved = _amount.resolve(food);
    if (_others) {
      return ScanPanel(
        // One level above a plain result, as the dense result: the product
        // and its macros stay on top, the frozen photo still shows above.
        height: ScanPanelHeight.dense,
        // Down closes the whole sheet, as on any sheet with a pushed level;
        // right goes back a level.
        onDismiss: widget.saving ? null : widget.onClose,
        onBack: () => setState(() => _others = false),
        header: KalloSheetSubHeader(
          title: 'logging.scan.otherNutrients'.tr(),
          onBack: () => setState(() => _others = false),
        ),
        body: ScanOtherNutrientsPage(
          header: ScanResultHeader(
            name: food.name,
            subtitle: _subtitle,
            kcal: food.valueFor('calories', resolved),
            protein: food.valueFor('proteinGrams', resolved),
            carbs: food.valueFor('carbsGrams', resolved),
            fat: food.valueFor('fatGrams', resolved),
          ),
          caption: _amountCaption(resolved),
          rows: [
            for (final d in labelMicronutrientDefinitions)
              if (food.valueFor(d.key, resolved) case final value?)
                ScanNutrientRow(
                  label: 'logging.labelScan.nutrients.${d.labelKey}'.tr(),
                  value: (value * 10).round() / 10,
                  unit: d.unit,
                ),
          ],
        ),
      );
    }

    final dense = _amount.portion == ScanPortion.custom && food.unit == 'ml';
    return ScanPanel(
      height: dense ? ScanPanelHeight.dense : ScanPanelHeight.result,
      onDismiss: widget.saving ? null : widget.onClose,
      header: KalloSheetHeader(
        title: _title,
        onClose: widget.onClose,
        closeEnabled: !widget.saving,
        trailing: SheetCapsuleButton(
          label: 'logging.scan.edit'.tr(),
          onTap: widget.saving ? null : widget.onEdit,
        ),
      ),
      body: ScanResultBody(
        food: food,
        amount: _amount,
        subtitle: _subtitle,
        enabled: !widget.saving,
        onAmount: widget.onAmount,
        onOtherNutrients: () => setState(() => _others = true),
      ),
      dock: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (widget.errorText != null) ...[
              Text(
                widget.errorText!,
                textAlign: TextAlign.center,
                style: dashMeta(color: KalloColors.danger),
              ),
              const SizedBox(height: 8),
            ],
            KalloButton(
              title: widget.ctaLabel,
              loading: widget.saving,
              onPressed: () => widget.onAdd(resolved),
            ),
          ],
        ),
      ),
    );
  }
}
