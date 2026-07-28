import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../theme/nham_theme.dart';

// Today / Week / Month — the header-anchored timeframe toggle (90d retired).
//
// All three labels are the same KIND of token on purpose. They used to mix a
// word with two abbreviations ("Today / 7d / 30d"), which left the first
// segment crowded and the other two swimming in an equal-width cell. It read
// worse in Vietnamese, where "7 ngày" had been clipped to "7n" — not something
// the language actually abbreviates that way.
const List<String> _ranges = ['1d', '7d', '30d'];

/// A compact, equal-width segmented control (iOS style): a warm track with a
/// single white "thumb" sliding under the active segment. Lives in the header
/// beside the menu button.
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
        '1d' => NutritionRangeInput.d1,
        '7d' => NutritionRangeInput.d7,
        '30d' => NutritionRangeInput.d30,
        _ => NutritionRangeInput.auto,
      };

  @override
  Widget build(BuildContext context) {
    final activeIndex =
        _ranges.indexOf(resolvedRange).clamp(0, _ranges.length - 1);

    return Opacity(
      opacity: disabled ? 0.6 : 1,
      child: SizedBox(
        width: 180,
        height: 34,
        child: Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: kTrack,
            borderRadius: BorderRadius.circular(NhamRadii.pill),
          ),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final segWidth = constraints.maxWidth / _ranges.length;
              return Stack(
                children: [
                  // Sliding white thumb under the active segment.
                  AnimatedAlign(
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeOutCubic,
                    alignment: Alignment(
                      _ranges.length == 1
                          ? 0
                          : -1 + 2 * (activeIndex / (_ranges.length - 1)),
                      0,
                    ),
                    child: Container(
                      width: segWidth,
                      height: constraints.maxHeight,
                      decoration: BoxDecoration(
                        color: kCardSurface,
                        borderRadius: BorderRadius.circular(NhamRadii.pill),
                        boxShadow: const [NhamShadows.xs],
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      for (var i = 0; i < _ranges.length; i++)
                        Expanded(
                          child: _Segment(
                            label: tr('nutrition.range.${_ranges[i]}'),
                            active: i == activeIndex,
                            onTap: disabled
                                ? null
                                : () {
                                    HapticFeedback.selectionClick();
                                    onRangeChange(_inputFor(_ranges[i]));
                                  },
                          ),
                        ),
                    ],
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: active,
      excludeSemantics: true,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Center(
          child: AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 200),
            // Medium, not semibold — 500 is the weight ceiling.
            style: dashMeta(
              color: active ? kInk : kInkMuted,
            ).copyWith(fontWeight: active ? FontWeight.w500 : FontWeight.w400),
            // Words are wider than "7d" was, and Vietnamese wider still, so
            // the longest label scales down rather than clipping at the top of
            // the Dynamic Type range. Segmented controls shrink here on iOS
            // too; the alternative is a truncated word.
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(label, maxLines: 1, softWrap: false),
            ),
          ),
        ),
      ),
    );
  }
}
