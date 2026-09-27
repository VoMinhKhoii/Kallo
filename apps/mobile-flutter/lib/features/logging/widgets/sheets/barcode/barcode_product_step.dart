import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../models/nutrition/barcode_product.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../logic/barcode_amount.dart';
import 'barcode_amount_controls.dart';
import 'barcode_grams_picker.dart';
import 'barcode_nutrition_preview.dart';
import 'barcode_product_footer.dart';
import 'barcode_product_header.dart';
import 'barcode_serving_picker.dart';
import '../../../logic/relog/scan_purpose.dart';

/// The quantity step of the barcode sheet: pick an amount by serving, whole
/// package, or a custom amount in the product's unit (grams, or millilitres
/// for a drink) — only the modes the product has sizing for — with a live
/// nutrition preview for the chosen amount.
///
/// Port of the web's `barcode-product-step.tsx`. Owns all amount state; the
/// sheet keys it on `product.barcode` so defaults re-initialize per scan.
class BarcodeProductStep extends StatefulWidget {
  const BarcodeProductStep({
    super.key,
    required this.product,
    required this.saving,
    required this.onBack,
    required this.onConfirm,
    required this.purpose,
    this.errorText,
  });

  final BarcodeProduct product;

  /// Why the sheet was opened — the CTA names what confirming will do.
  final ScanPurpose purpose;
  final bool saving;
  final VoidCallback onBack;

  /// Called with the resolved amount, in the product's unit, to log.
  final ValueChanged<int> onConfirm;

  /// Inline save error, above the footer so a failed attempt keeps the amount.
  final String? errorText;

  @override
  State<BarcodeProductStep> createState() => _BarcodeProductStepState();
}

class _BarcodeProductStepState extends State<BarcodeProductStep> {
  late final List<BarcodeAmountMode> _modes = availableModes(widget.product);
  late BarcodeAmountMode _mode = _modes.first;
  int _servings = 1;
  late int _customGrams = defaultCustomGrams(widget.product);

  int get _grams => resolveGrams(
    mode: _mode,
    servings: _servings,
    customGrams: _customGrams,
    product: widget.product,
  );

  void _setMode(BarcodeAmountMode mode) {
    if (mode == _mode) return;
    HapticFeedback.selectionClick();
    setState(() => _mode = mode);
  }

  void _adjustServings(int delta) {
    HapticFeedback.selectionClick();
    setState(() => _servings = clampServings(_servings + delta));
  }

  void _adjustGrams(int delta) {
    HapticFeedback.selectionClick();
    setState(() => _customGrams = clampGrams(_customGrams + delta));
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final grams = _grams;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              KalloSpacing.sp4,
              KalloSpacing.sp2,
              KalloSpacing.sp4,
              KalloSpacing.sp3,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                BarcodeProductHeader(product: product),
                const SizedBox(height: KalloSpacing.sp3),

                // Amount-mode segmented control (only when there's a choice).
                if (_modes.length > 1) ...[
                  BarcodeAmountModeSwitch(
                    modes: _modes,
                    selected: _mode,
                    onSelect: _setMode,
                    unit: product.amountUnit,
                  ),
                  const SizedBox(height: KalloSpacing.sp3),
                ],

                // Amount picker for the selected mode.
                switch (_mode) {
                  BarcodeAmountMode.serving => BarcodeServingPicker(
                    servings: _servings,
                    servingSizeG: product.servingSizeG ?? 0,
                    totalGrams: grams,
                    disabled: widget.saving,
                    onAdjust: _adjustServings,
                    unit: product.amountUnit,
                  ),
                  BarcodeAmountMode.package => BarcodePackageCard(
                    packageSizeG: product.packageSizeG ?? 0,
                    unit: product.amountUnit,
                  ),
                  BarcodeAmountMode.grams => BarcodeGramsPicker(
                    grams: _customGrams,
                    unit: product.amountUnit,
                    disabled: widget.saving,
                    onAdjust: _adjustGrams,
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() => _customGrams = clampGrams(value));
                    },
                  ),
                },
                const SizedBox(height: KalloSpacing.sp3),

                BarcodeNutritionPreview(product: product, grams: grams),
              ],
            ),
          ),
        ),

        BarcodeProductFooter(
          confirmLabel: widget.purpose.ctaKey.tr(),
          saving: widget.saving,
          errorText: widget.errorText,
          onBack: widget.onBack,
          onConfirm: () => widget.onConfirm(grams),
        ),
      ],
    );
  }
}
