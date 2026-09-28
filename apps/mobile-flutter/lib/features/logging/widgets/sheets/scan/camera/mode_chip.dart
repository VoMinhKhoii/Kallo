import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../../services/billing/entitlement_state.dart';
import '../../../../../../services/billing/feature_lock.dart';
import '../../../../../../shared/widgets/badges/premium_chip.dart';
import '../../../../../../shared/widgets/form/segmented/segmented_strip.dart';
import '../../../../../../shared/widgets/form/segmented/segmented_tone.dart';
import '../../../../../../theme/kallo_theme.dart';

/// Which side of the package the camera is pointed at.
enum ScanType { barcode, label }

/// The camera's mode switch — the app's one segmented control in its
/// over-a-photo tone: dark glass like the buttons around it, the chosen mode
/// on a lighter pill. Words, not icons: "Barcode" and "Nutrition label" are
/// what the user is pointing at.
///
/// Nutrition label is Premium: while the plan lacks `label_scan` a tap opens
/// the paywall instead of switching, and the Premium chip sits just past the
/// strip, beside that segment — inside it, the equal-width segments would
/// outgrow the screen and shrink both labels.
class ScanModeChip extends ConsumerWidget {
  const ScanModeChip({super.key, required this.value, required this.onChange});

  final ScanType value;
  final ValueChanged<ScanType> onChange;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final labelGate = premiumGate(ref, PremiumFeature.labelScan);
    final strip = SegmentedStrip(
      tone: SegmentedStripTone.overPhoto,
      activeIndex: value.index,
      options: [
        OptionStripItem(
          value: ScanType.barcode.name,
          label: 'logging.scan.modeBarcode'.tr(),
        ),
        OptionStripItem(
          value: ScanType.label.name,
          label: 'logging.scan.modeLabel'.tr(),
        ),
      ],
      onChange: (name) {
        final type = ScanType.values.byName(name);
        if (type == ScanType.label) {
          labelGate.tap(context, () => onChange(type))?.call();
        } else {
          onChange(type);
        }
      },
    );
    if (!labelGate.locked) return strip;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        strip,
        const SizedBox(width: KalloSpacing.sp2),
        const PremiumChip(),
      ],
    );
  }
}
