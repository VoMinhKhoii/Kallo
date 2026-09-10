import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../models/nutrition/barcode_product.dart';
import '../../../../../shared/widgets/form/sheet_action_buttons.dart';
import '../../../../../shared/widgets/form/sheet_confirm_button.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../logic/barcode_amount.dart';
import 'barcode_amount_controls.dart';
import 'barcode_grams_picker.dart';
import 'barcode_nutrition_preview.dart';
import 'barcode_serving_picker.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../logic/relog/scan_purpose.dart';

/// The quantity step of the barcode sheet: pick an amount by serving, whole
/// package, or custom grams — only the modes the product has sizing for — with
/// a live nutrition preview for the chosen amount.
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

  /// Called with the resolved gram amount to log.
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
                // Product header: brand eyebrow + name as the sheet's title.
                if (product.brand != null && product.brand!.isNotEmpty)
                  Text(product.brand!.toUpperCase(), style: dashEyebrow()),
                Text(product.name, style: kSectionHeader()),
                const SizedBox(height: KalloSpacing.sp3),

                // Amount-mode segmented control (only when there's a choice).
                if (_modes.length > 1) ...[
                  BarcodeAmountModeSwitch(
                    modes: _modes,
                    selected: _mode,
                    onSelect: _setMode,
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
                  ),
                  BarcodeAmountMode.package => BarcodePackageCard(
                    packageSizeG: product.packageSizeG ?? 0,
                  ),
                  BarcodeAmountMode.grams => BarcodeGramsPicker(
                    grams: _customGrams,
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

        if (widget.errorText != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              KalloSpacing.sp4,
              0,
              KalloSpacing.sp4,
              KalloSpacing.sp2,
            ),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                widget.errorText!,
                style: dashMeta(color: KalloColors.danger),
              ),
            ),
          ),

        // Pinned footer: back + add meal.
        Container(
          padding: EdgeInsets.fromLTRB(
            KalloSpacing.sp4,
            KalloSpacing.sp3,
            KalloSpacing.sp4,
            MediaQuery.of(context).padding.bottom + KalloSpacing.sp3,
          ),
          decoration: const BoxDecoration(
            color: KalloColors.elev,
            border: Border(top: BorderSide(color: KalloColors.borderFaint)),
          ),
          child: Row(
            children: [
              // Deliberately silent: leaving the step is not a confirmation,
              // so it gets no haptic the way the other quiet links do.
              QuietIconButton(
                icon: LucideIcons.arrowLeft300,
                label: 'logging.barcode.back'.tr(),
                onTap: widget.saving ? null : widget.onBack,
                haptic: false,
              ),
              const Spacer(),
              SheetConfirmButton(
                label: widget.purpose.ctaKey.tr(),
                saving: widget.saving,
                onTap: () => widget.onConfirm(grams),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
