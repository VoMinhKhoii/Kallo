import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../shared/widgets/form/option_strip.dart';
import '../../../../../shared/widgets/form/segmented_strip.dart';
import '../../../../../theme/kallo_theme.dart';

/// Which side of the package the user is pointing the phone at.
enum ScanType { barcode, label }

/// Barcode / nutrition-label switch at the top of the scan sheet.
///
/// It is the shared [SegmentedStrip] and nothing else — it used to carry its
/// own copy of the anatomy, drawn as a fully rounded PILL with each segment
/// cross-fading its own `AnimatedContainer` background, so the white block
/// vanished from one side and reappeared on the other instead of travelling.
/// The primitive owns the rounded-rectangle track, the sliding thumb and the
/// pop-then-travel motion; this file owns the two labels and the enum.
///
/// It fills the sheet's content width (the body's own 16pt inset) rather than
/// the 240pt it was pinned to: at 240 each segment had ~105pt of text room,
/// which ellipsised the second label to "Nutrition l…" in English and could
/// not hold the Vietnamese one at ANY size the ramp allows. Width plus the
/// shorter label ("Nutrition" / "Dinh dưỡng") is what makes both fit at the
/// 1.3x text scale — see `scan_type_toggle_test.dart`, which measures it.
///
/// Shown only while a branch is still at its entry step — once a product or a
/// scanned label is on screen, switching would throw that work away.
class ScanTypeToggle extends StatelessWidget {
  const ScanTypeToggle({super.key, required this.value, required this.onChange});

  final ScanType value;
  final ValueChanged<ScanType> onChange;

  static String _label(ScanType type) => switch (type) {
    ScanType.barcode => 'logging.scan.barcodeTab'.tr(),
    ScanType.label => 'logging.scan.labelTab'.tr(),
  };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
      child: SegmentedStrip(
        options: [
          for (final type in ScanType.values)
            OptionStripItem(value: type.name, label: _label(type)),
        ],
        activeIndex: value.index,
        onChange: (name) => onChange(ScanType.values.byName(name)),
      ),
    );
  }
}
