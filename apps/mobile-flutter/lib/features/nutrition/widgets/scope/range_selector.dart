import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/nutrition/nutrition.dart';
import '../../../../shared/widgets/form/option_strip.dart';

// 7 days / 30 days / 90 days — the timeframe toggle on the page-title row.
//
// All three labels are the same KIND of token on purpose: a day count, spelled
// out. The mixed set this replaced ("Today / Week / Month") named three
// different units, so the segments carried no common scale. Spelled out, not
// abbreviated — Vietnamese renders these as "7 ngày", and the old "7n" clip is
// not something the language actually does.
//
// Today (`1d`) is deliberately absent: a single day has no trend to draw, and
// the dashboard already owns the today view. It stays valid in the API and in
// `NutritionRangeInput` so already-shipped builds that still request it work.
const List<String> _ranges = ['7d', '30d', '90d'];

/// The page's timeframe control: the shared [OptionStrip.segmented] skin at the
/// artboard's 216pt width, sitting on the title row beside "Nutrition".
class NutritionRangeSelector extends StatelessWidget {
  const NutritionRangeSelector({
    super.key,
    required this.resolvedRange,
    required this.onRangeChange,
    this.disabled = false,
  });

  final String resolvedRange;
  final ValueChanged<NutritionRangeInput> onRangeChange;
  final bool disabled;

  NutritionRangeInput _inputFor(String range) => switch (range) {
    '7d' => NutritionRangeInput.d7,
    '30d' => NutritionRangeInput.d30,
    '90d' => NutritionRangeInput.d90,
    _ => NutritionRangeInput.auto,
  };

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: disabled ? 0.6 : 1,
      child: IgnorePointer(
        ignoring: disabled,
        child: SizedBox(
          width: 216,
          child: OptionStrip.segmented(
            options: [
              for (final range in _ranges)
                OptionStripItem(
                  value: range,
                  label: tr('nutrition.range.$range'),
                ),
            ],
            // NOT clamped to a valid index: `1d` is still a valid server
            // response (retired from this control, kept in the API), and
            // clamping would light up `7d` as though the user had picked it.
            value: resolvedRange,
            onChange: (range) => onRangeChange(_inputFor(range)),
          ),
        ),
      ),
    );
  }
}
