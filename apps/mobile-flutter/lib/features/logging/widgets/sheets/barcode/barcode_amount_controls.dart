/// The two atoms the amount step is built from: the mode switch across the top
/// and the ± stepper both pickers flank their value with.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../shared/widgets/typography/kallo_text.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../../../theme/kallo_typography.dart';
import '../../../logic/barcode_amount.dart';

/// Serving / whole package / grams, under its own label — rendered only when
/// the product has sizing for more than one of them.
class BarcodeAmountModeSwitch extends StatelessWidget {
  const BarcodeAmountModeSwitch({
    super.key,
    required this.modes,
    required this.selected,
    required this.onSelect,
  });

  final List<BarcodeAmountMode> modes;
  final BarcodeAmountMode selected;
  final ValueChanged<BarcodeAmountMode> onSelect;

  static String _label(BarcodeAmountMode mode) => switch (mode) {
    BarcodeAmountMode.serving => 'logging.barcode.amountServing'.tr(),
    BarcodeAmountMode.package => 'logging.barcode.amountPackage'.tr(),
    BarcodeAmountMode.grams => 'logging.barcode.amountGrams'.tr(),
  };

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KalloText(
          'logging.barcode.amountModeLabel'.tr(),
          variant: KalloTextVariant.small,
          style: KalloTextStyles.sansSemiBold(
            fontSize: KalloFontSize.xs,
          ).copyWith(color: KalloColors.text),
        ),
        const SizedBox(height: KalloSpacing.sp2),
        Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: KalloColors.hover,
            borderRadius: BorderRadius.circular(KalloRadii.lg),
          ),
          child: Row(
            children: [
              for (final mode in modes) Expanded(child: _segment(mode)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _segment(BarcodeAmountMode mode) {
    final isSelected = mode == selected;
    final label = _label(mode);
    return Semantics(
      button: true,
      selected: isSelected,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => onSelect(mode),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp2),
          decoration: BoxDecoration(
            color: isSelected ? KalloColors.elev : Colors.transparent,
            borderRadius: BorderRadius.circular(KalloRadii.md),
            boxShadow:
                isSelected
                    ? [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.06),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ]
                    : null,
          ),
          child: Center(
            child: Text(
              label,
              style: KalloTextStyles.sansSemiBold(
                fontSize: KalloFontSize.xs,
              ).copyWith(
                color: isSelected ? KalloColors.text : KalloColors.textMuted,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A 40pt square hairline button carrying a ± glyph; dims to 0.4 when its
/// [onTap] is null.
class BarcodeStepperButton extends StatelessWidget {
  const BarcodeStepperButton({
    super.key,
    required this.icon,
    required this.label,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: Opacity(
          opacity: enabled ? 1 : 0.4,
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: KalloColors.elev,
              borderRadius: BorderRadius.circular(KalloRadii.lg),
              border: Border.all(color: KalloColors.inputBorder),
            ),
            child: Icon(
              icon,
              size: KalloIcons.tertiary,
              color: KalloColors.text,
            ),
          ),
        ),
      ),
    );
  }
}
