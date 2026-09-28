import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../../../shared/widgets/sheet/sheet_capsule_button.dart';
import '../../../../../../shared/widgets/surface/kallo_button.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_colors.dart';
import '../../../../logic/scan/amount.dart';
import '../../../../logic/scan/captions.dart';
import '../../../../logic/scan/food.dart';
import '../panel/panel.dart';
import 'body.dart';

/// A scan result over the frozen camera: its title, Edit, the result body, and
/// Add meal. "Other nutrients" is the next level in (`ScanOthersPanel`), a
/// page of the same sheet.
class ScanResultPanel extends StatelessWidget {
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
    required this.onOtherNutrients,
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
  final VoidCallback onOtherNutrients;

  /// The sheet's title says where the numbers came from.
  String get _title =>
      switch (food.source) {
        ScanFoodSource.barcode => 'logging.scan.barcodeTitle',
        ScanFoodSource.label => 'logging.scan.labelTitle',
        ScanFoodSource.manual => 'logging.scan.newFood',
      }.tr();

  @override
  Widget build(BuildContext context) {
    final resolved = amount.resolve(food);
    final dense = amount.portion == ScanPortion.custom && food.unit == 'ml';
    return ScanPanel(
      height: dense ? ScanPanelHeight.dense : ScanPanelHeight.result,
      onDismiss: saving ? null : onClose,
      header: KalloSheetHeader(
        title: _title,
        onClose: onClose,
        closeEnabled: !saving,
        trailing: SheetCapsuleButton(
          label: 'logging.scan.edit'.tr(),
          onTap: saving ? null : onEdit,
        ),
      ),
      body: ScanResultBody(
        food: food,
        amount: amount,
        subtitle: scanFoodSubtitle(food),
        enabled: !saving,
        onAmount: onAmount,
        onOtherNutrients: onOtherNutrients,
      ),
      dock: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (errorText != null) ...[
              Text(
                errorText!,
                textAlign: TextAlign.center,
                style: dashMeta(color: KalloColors.danger),
              ),
              const SizedBox(height: 8),
            ],
            KalloButton(
              title: ctaLabel,
              loading: saving,
              onPressed: () => onAdd(resolved),
            ),
          ],
        ),
      ),
    );
  }
}
