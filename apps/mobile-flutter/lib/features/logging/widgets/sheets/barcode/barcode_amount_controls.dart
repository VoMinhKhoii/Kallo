/// The two atoms the amount step is built from: the mode switch across the top
/// and the ± stepper both pickers flank their value with.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../shared/widgets/form/option_strip.dart';
import '../../../../../shared/widgets/form/segmented_strip.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../logic/barcode_amount.dart';

/// Serving / whole package / grams, under its own label — rendered only when
/// the product has sizing for more than one of them.
///
/// The look this control had IS the app's mode-switch look (beige track,
/// white rounded-rectangle thumb); it now draws through the shared
/// [SegmentedStrip] so the thumb slides and pops instead of one segment's
/// background fading out while another's fades in.
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
        Text('logging.barcode.amountModeLabel'.tr(), style: kGroupLabel()),
        const SizedBox(height: KalloSpacing.sp2),
        SegmentedStrip(
          options: [
            for (final mode in modes)
              OptionStripItem(value: mode.name, label: _label(mode)),
          ],
          activeIndex: modes.indexOf(selected),
          onChange: (name) =>
              onSelect(modes.firstWhere((m) => m.name == name)),
        ),
      ],
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
