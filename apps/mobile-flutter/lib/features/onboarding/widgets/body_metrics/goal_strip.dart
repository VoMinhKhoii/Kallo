import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/form/option_strip.dart';
import '../../../../shared/widgets/form/segmented_strip.dart';

const List<String> _goals = ['cutting', 'maintaining', 'bulking'];

/// The three-segment goal toggle inside `goal-tuning.tsx`.
///
/// Labels only, three equal segments, one selection — the shared
/// [SegmentedStrip] exactly. It used to carry its own track, its own hairline
/// @50% fill and its own per-segment `AnimatedContainer` (so the white chip
/// blinked between segments rather than sliding), plus the one `w500` label
/// the weight pass missed. All of that now comes from the primitive.
class GoalStrip extends StatelessWidget {
  const GoalStrip({super.key, required this.value, required this.onChange});

  final String value;
  final ValueChanged<String> onChange;

  @override
  Widget build(BuildContext context) {
    return SegmentedStrip(
      options: [
        for (final goal in _goals)
          OptionStripItem(
            value: goal,
            label: tr('onboarding.bodyMetrics.$goal'),
          ),
      ],
      activeIndex: _goals.indexOf(value),
      onChange: onChange,
    );
  }
}
