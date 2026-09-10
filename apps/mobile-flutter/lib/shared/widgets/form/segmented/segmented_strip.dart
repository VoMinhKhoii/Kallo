import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import '../option_strip.dart' show OptionStripItem;
import 'segmented_thumb.dart';

/// The one mode-switch primitive — every segmented control draws through it,
/// via [OptionStrip.segmented] or directly.
///
/// ONE documented exception, and the bar for adding another is this high: the
/// paywall's `PlanToggle` has a permanently-gold half, which this model cannot
/// express — a single travelling thumb would cover the gold on arrival, and a
/// thumb that changed colour in flight would be the cross-fade described
/// below. It matches this file on everything the gold does not force (track,
/// thumb shadow, label tier, haptic, semantics). A control that merely wants
/// different COLOURS is not an exception; it belongs here.
///
/// **A pill on a pill** (onboarding canvas, 2026-09-05): the [KalloColors.track]
/// track, fully rounded, under a white fully-rounded thumb — the stadium the
/// 52pt fields and full-width buttons already use, so the three primitives
/// share one shape. 36pt visual inside a 44pt tap target, two layers,
/// because a 44pt track makes a three-way picker button-tall.
///
/// **The thumb pops, then travels** — [SegmentedThumb] owns that motion and
/// the reasoning behind it.
class SegmentedStrip extends StatefulWidget {
  const SegmentedStrip({
    super.key,
    required this.options,
    required this.activeIndex,
    required this.onChange,
  });

  final List<OptionStripItem> options;

  /// -1 when nothing is selected — the thumb is absent, not parked on a
  /// segment the user did not choose.
  final int activeIndex;
  final ValueChanged<String> onChange;

  static const double height = 36, target = 44, inset = 3;

  @override
  State<SegmentedStrip> createState() => _SegmentedStripState();
}

class _SegmentedStripState extends State<SegmentedStrip> {
  void _select(int index) {
    if (index == widget.activeIndex) return;
    HapticFeedback.selectionClick();
    widget.onChange(widget.options[index].value);
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    height: SegmentedStrip.target,
    child: Stack(
      alignment: Alignment.center,
      children: [
        SizedBox(height: SegmentedStrip.height, child: _track()),
        // The tap layer spans the full 44 above the track, so a thumb tapped
        // near its top or bottom edge still registers.
        Row(
          children: [
            for (var i = 0; i < widget.options.length; i++)
              Expanded(child: _tapTarget(i)),
          ],
        ),
      ],
    ),
  );

  Widget _tapTarget(int i) => Semantics(
    button: true,
    selected: i == widget.activeIndex,
    excludeSemantics: true,
    label: widget.options[i].label,
    onTap: () => _select(i),
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _select(i),
      child: const SizedBox(height: SegmentedStrip.target),
    ),
  );

  Widget _track() => Container(
    padding: const EdgeInsets.all(SegmentedStrip.inset),
    decoration: BoxDecoration(
      color: KalloColors.track,
      borderRadius: BorderRadius.circular(KalloRadii.pill),
    ),
    child: Stack(
      children: [
        if (widget.activeIndex >= 0)
          SegmentedThumb(
            activeIndex: widget.activeIndex,
            count: widget.options.length,
          ),
        Row(
          children: [
            for (var i = 0; i < widget.options.length; i++)
              Expanded(child: _label(i)),
          ],
        ),
      ],
    ),
  );

  /// Ink on the active segment, muted beside it — colour marks the selection,
  /// never weight. Only the colour animates, so the paragraph repaints rather
  /// than re-measuring; [FittedBox] shrinks the longest label at the top of
  /// the Dynamic Type range instead of clipping it.
  Widget _label(int i) => Center(
    child: TweenAnimationBuilder<Color?>(
      duration: KalloMotion.quick,
      curve: KalloEase.standard,
      tween: ColorTween(end: i == widget.activeIndex ? kInk : kInkMuted),
      builder: (context, color, child) => FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(
          widget.options[i].label,
          maxLines: 1,
          softWrap: false,
          style: dashBody(color: color ?? kInkMuted),
        ),
      ),
    ),
  );
}
