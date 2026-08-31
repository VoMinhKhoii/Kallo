import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_motion.dart';
import 'option_strip.dart' show OptionStripItem;

/// The native-pass segmented control that [OptionStrip.segmented] draws — kept
/// in its own file so `option_strip.dart` stays the one place a caller picks a
/// skin.
///
/// **36pt visual on a 44pt tap target.** The track is 36 tall, the app-wide
/// chip metric; the row of targets over it is 44, the iOS minimum. They are
/// separate layers on purpose — growing the track to 44 would make a three-way
/// range picker as tall as a button, and shrinking the target to 36 is what the
/// native audit flagged in the first place.
///
/// A single white thumb SLIDES under the active segment rather than each
/// segment fading its own chip in: with three equal segments the movement is
/// what tells you the control is one control.
class SegmentedStrip extends StatelessWidget {
  const SegmentedStrip({
    super.key,
    required this.options,
    required this.activeIndex,
    required this.onChange,
  });

  final List<OptionStripItem> options;

  /// -1 when nothing is selected — the thumb is then absent rather than parked
  /// on a segment the user did not choose.
  final int activeIndex;
  final ValueChanged<String> onChange;

  static const double _height = 36;
  static const double _target = 44;
  static const double _inset = 3;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: _target,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(height: _height, child: _track()),
          // The tap layer spans the full 44 and sits above the track, so a
          // thumb tapped near its top or bottom edge still registers.
          Row(
            children: [
              for (var i = 0; i < options.length; i++)
                Expanded(
                  child: Semantics(
                    button: true,
                    selected: i == activeIndex,
                    excludeSemantics: true,
                    label: options[i].label,
                    onTap: () => _select(i),
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => _select(i),
                      child: const SizedBox(height: _target),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  void _select(int index) {
    HapticFeedback.selectionClick();
    onChange(options[index].value);
  }

  Widget _track() {
    return Container(
      padding: const EdgeInsets.all(_inset),
      decoration: BoxDecoration(
        color: kTrack,
        borderRadius: BorderRadius.circular(_height / 2),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final segWidth = constraints.maxWidth / options.length;
          return Stack(
            children: [
              if (activeIndex >= 0)
                AnimatedAlign(
                  duration: KalloMotion.quick,
                  curve: Curves.easeOutCubic,
                  alignment: Alignment(
                    options.length == 1
                        ? 0
                        : -1 + 2 * (activeIndex / (options.length - 1)),
                    0,
                  ),
                  child: Container(
                    width: segWidth,
                    height: constraints.maxHeight,
                    decoration: BoxDecoration(
                      color: kCardSurface,
                      borderRadius: BorderRadius.circular(
                        (_height - _inset * 2) / 2,
                      ),
                    ),
                  ),
                ),
              Row(
                children: [
                  for (var i = 0; i < options.length; i++)
                    Expanded(
                      child: Center(
                        child: AnimatedDefaultTextStyle(
                          duration: KalloMotion.quick,
                          // Medium on the active segment, regular beside it —
                          // 500 is this palette's weight ceiling.
                          style: dashBody(
                            color: i == activeIndex ? kInk : kInkMuted,
                            weight:
                                i == activeIndex
                                    ? FontWeight.w500
                                    : FontWeight.w400,
                          ),
                          // Words are wider than "7d" was, and Vietnamese
                          // wider still, so the longest label scales down
                          // rather than clipping at the top of the Dynamic
                          // Type range. iOS segmented controls shrink here
                          // too; the alternative is a truncated word.
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              options[i].label,
                              maxLines: 1,
                              softWrap: false,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}
