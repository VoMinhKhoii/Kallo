/// The custom-grams mode: a typed amount flanked by ± steppers, with one-tap
/// chips for the portions people reach for most.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../shared/widgets/form/decimal_input.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../../../theme/kallo_typography.dart';
import '../../../logic/barcode_amount.dart';
import 'barcode_amount_controls.dart';

class BarcodeGramsPicker extends StatelessWidget {
  const BarcodeGramsPicker({
    super.key,
    required this.grams,
    required this.disabled,
    required this.onAdjust,
    required this.onChanged,
  });

  final int grams;
  final bool disabled;
  final ValueChanged<int> onAdjust;
  final ValueChanged<double?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            BarcodeStepperButton(
              icon: LucideIcons.minus300,
              label: 'logging.barcode.decreaseGrams'.tr(),
              onTap: disabled || grams <= 1 ? null : () => onAdjust(-gramStep),
            ),
            const SizedBox(width: KalloSpacing.sp2),
            Expanded(
              child: DecimalInput(
                // Keyed so stepper taps (which change state outside the
                // field) refresh the text.
                key: ValueKey(grams),
                value: grams.toDouble(),
                integer: true,
                onValueChange: disabled ? (_) {} : onChanged,
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(width: KalloSpacing.sp2),
            BarcodeStepperButton(
              icon: LucideIcons.plus300,
              label: 'logging.barcode.increaseGrams'.tr(),
              onTap:
                  disabled || grams >= maxFoodItemGrams
                      ? null
                      : () => onAdjust(gramStep),
            ),
          ],
        ),
        const SizedBox(height: KalloSpacing.sp2),
        // Quick one-tap portions.
        Wrap(
          spacing: KalloSpacing.sp2,
          runSpacing: KalloSpacing.sp1,
          children: [
            for (final option in quickGramOptions)
              _QuickChip(
                label: '${option}g',
                selected: grams == option,
                onTap:
                    disabled
                        ? null
                        : () {
                          HapticFeedback.selectionClick();
                          onChanged(option.toDouble());
                        },
              ),
          ],
        ),
      ],
    );
  }
}

class _QuickChip extends StatelessWidget {
  const _QuickChip({required this.label, required this.selected, this.onTap});

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: KalloSpacing.sp3,
            // Tap-target height: ~40px with the xs label, close to the app's
            // 44pt convention — the previous 6px made ~30px chips in a tight
            // row, inviting mis-taps.
            vertical: 10,
          ),
          decoration: BoxDecoration(
            color: selected ? KalloColors.hover : KalloColors.elev,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? KalloColors.border : KalloColors.inputBorder,
            ),
          ),
          child: Text(
            label,
            style: KalloTextStyles.sansMedium(
              fontSize: KalloFontSize.xs,
            ).copyWith(
              color: selected ? KalloColors.text : KalloColors.textMuted,
            ),
          ),
        ),
      ),
    );
  }
}
