import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import 'segmented_gestures.dart';
import 'segmented_label.dart';
import 'segmented_motion.dart';
import 'segmented_thumb.dart';
import 'segmented_tone.dart';

/// A single segment of a [SegmentedStrip]: the value it reports, its label,
/// and an optional Lucide glyph drawn inline before the label.
class OptionStripItem {
  final String value;
  final String label;
  final IconData? icon;

  /// Drawn after the label — the Premium chip on a gated segment.
  final Widget? badge;
  const OptionStripItem({
    required this.value,
    required this.label,
    this.icon,
    this.badge,
  });
}

/// The one mode-switch primitive — every segmented control draws through it.
///
/// **Not `CupertinoSlidingSegmentedControl`** (`kallo-design/mobile.md`,
/// *Cupertino wherever it exists*). The SDK control draws a rounded
/// superellipse with a FIXED 9pt track radius and 7pt thumb radius
/// (`_kCornerRadius` / `_kThumbRadius`, `cupertino/sliding_segmented_control.dart`
/// lines 28 and 31, Flutter 3.44) — the iOS 13–18 shape. Both are private and
/// the widget takes no shape or radius, so it cannot draw iOS 26's capsule,
/// the shape the app's 52pt fields and full-width buttons already share.
/// Retire this primitive when the SDK control draws the capsule or exposes
/// its radius.
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
/// share one shape. Sized and drawn like iOS 26's own control (owner,
/// 2026-10-14, after the Claude iOS app's switch): a 42pt track, the thumb
/// 2pt inside it with a hairline rim, every label ink and the chosen one 500
/// (Be Vietnam Pro's 600 reads heavier than SF's). The 36pt track with muted
/// labels it replaced read as a web toggle. Taps still span the full 44pt.
///
/// **It moves like iOS's own control**: [SegmentedMotion] has the springs,
/// [SegmentedGestures] the touch rules, both ported from the system control.
class SegmentedStrip extends StatefulWidget {
  const SegmentedStrip({
    super.key,
    required this.options,
    required this.activeIndex,
    required this.onChange,
    this.tone = SegmentedStripTone.standard,
  });

  final List<OptionStripItem> options;
  final SegmentedStripTone tone;

  /// -1 when nothing is selected — the thumb is absent, not parked on a
  /// segment the user did not choose.
  final int activeIndex;
  final ValueChanged<String> onChange;

  static const double height = 42, target = 44, inset = 2;

  @override
  State<SegmentedStrip> createState() => _SegmentedStripState();
}

class _SegmentedStripState extends State<SegmentedStrip> {
  /// Where the thumb is or is sliding to. Runs ahead of [activeIndex] while a
  /// finger drags the thumb, which reports nothing until it lets go.
  late int _thumb = widget.activeIndex;
  int? _pressed;
  bool _held = false;

  @override
  void didUpdateWidget(SegmentedStrip old) {
    super.didUpdateWidget(old);
    if (!_held) _thumb = widget.activeIndex;
  }

  void _select(int index) {
    if (index == widget.activeIndex) return;
    HapticFeedback.selectionClick();
    widget.onChange(widget.options[index].value);
  }

  /// Letting go of a dragged thumb sends it back to the chosen segment; the
  /// pick that follows (if any, and if the caller takes it — the scan
  /// camera's gated segment opens the paywall instead) moves it on before the
  /// frame is drawn. A cancelled or refused drag never shows a thumb parked
  /// on a segment that is not chosen.
  void _hold(bool held) => setState(() {
    _held = held;
    if (!held) _thumb = widget.activeIndex;
  });

  @override
  Widget build(BuildContext context) {
    final strip = SizedBox(
      height: SegmentedStrip.target,
      child: SegmentedGestures(
        count: widget.options.length,
        thumb: _thumb,
        onPressed: (i) => setState(() => _pressed = i),
        onHold: _hold,
        onSlide: (i) => setState(() => _thumb = i),
        onSelect: _select,
        // The touch layer spans the full 44 above the track, so a thumb
        // touched near its top or bottom edge still registers.
        child: Stack(
          alignment: Alignment.center,
          children: [
            SizedBox(height: SegmentedStrip.height, child: _track()),
            Row(
              children: [
                for (var i = 0; i < widget.options.length; i++)
                  Expanded(child: _semantics(i)),
              ],
            ),
          ],
        ),
      ),
    );
    // Equal segments either way; a strip that hugs its words takes the widest
    // label's width for each.
    return widget.tone.hugsLabels ? IntrinsicWidth(child: strip) : strip;
  }

  Widget _semantics(int i) => Semantics(
    button: true,
    selected: i == widget.activeIndex,
    excludeSemantics: true,
    label: widget.options[i].label,
    onTap: () => _select(i),
    child: const SizedBox(height: SegmentedStrip.target),
  );

  Widget _track() => Container(
    padding: const EdgeInsets.all(SegmentedStrip.inset),
    decoration: BoxDecoration(
      color: widget.tone.track,
      borderRadius: BorderRadius.circular(KalloRadii.pill),
    ),
    child: SegmentedMotion(
      index: _thumb < 0 ? 0 : _thumb,
      held: _held,
      builder:
          (context, position, scale) => Stack(
            children: [
              if (_thumb >= 0)
                SegmentedThumb(
                  position: position,
                  scale: scale,
                  count: widget.options.length,
                  color: widget.tone.thumb,
                  rim: widget.tone.rim,
                  raised: widget.tone.thumbShadow,
                ),
              Row(
                children: [
                  for (var i = 0; i < widget.options.length; i++)
                    Expanded(child: _label(i, i == _thumb ? scale : 1)),
                ],
              ),
            ],
          ),
    ),
  );

  Widget _label(int i, double scale) {
    final option = widget.options[i];
    return SegmentedLabel(
      label: option.label,
      icon: option.icon,
      badge: option.badge,
      color: widget.tone.label,
      selected: i == _thumb,
      pressed: _pressed == i,
      scale: scale,
      anchor: SegmentedThumb.anchor(i.toDouble(), widget.options.length),
      inset: widget.tone.labelInset,
    );
  }
}
