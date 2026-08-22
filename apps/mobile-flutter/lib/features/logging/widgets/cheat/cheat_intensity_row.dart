import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/logging/cheat.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../shared/widgets/form/option_strip.dart';

/// The light/medium/heavy indulgence picker shown above the composer whenever
/// cheat mode is selected — a quiet label + the shared segmented strip.
///
/// Shared, not private to the feed composer: the dashboard's quick-log sheet
/// offers the same mode selector, and a cheat mode whose magnitude is invisible
/// from where it was chosen would silently reuse whatever was last set.
class CheatIntensityRow extends StatelessWidget {
  const CheatIntensityRow({
    super.key,
    required this.value,
    required this.onChange,
  });

  final CheatIntensity value;
  final ValueChanged<CheatIntensity> onChange;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('logging.cheatIntensity.label'.tr(), style: dashMeta()),
              const SizedBox(height: 2),
              Text('logging.cheatIntensity.helper'.tr(), style: dashMeta()),
            ],
          ),
        ),
        const SizedBox(width: KalloSpacing.sp3),
        SizedBox(
          width: 200,
          child: OptionStrip.settings(
            value: value.name,
            options: [
              for (final intensity in CheatIntensity.values)
                OptionStripItem(
                  value: intensity.name,
                  label: 'logging.cheatIntensity.${intensity.name}'.tr(),
                ),
            ],
            onChange: (name) => onChange(CheatIntensity.values.byName(name)),
          ),
        ),
      ],
    );
  }
}
