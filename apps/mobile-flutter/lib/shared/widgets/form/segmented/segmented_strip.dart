import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
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
/// **The thumb pops, then travels** — [SegmentedThumb] owns that motion and
/// the reasoning behind it.
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
  void _select(int index) {
    if (index == widget.activeIndex) return;
    HapticFeedback.selectionClick();
    widget.onChange(widget.options[index].value);
  }

  @override
  Widget build(BuildContext context) {
    final strip = _strip();
    // Equal segments either way; a strip that hugs its words takes the widest
    // label's width for each.
    return widget.tone.hugsLabels ? IntrinsicWidth(child: strip) : strip;
  }

  Widget _strip() => SizedBox(
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
      color: widget.tone.track,
      borderRadius: BorderRadius.circular(KalloRadii.pill),
    ),
    child: Stack(
      children: [
        if (widget.activeIndex >= 0)
          SegmentedThumb(
            activeIndex: widget.activeIndex,
            count: widget.options.length,
            color: widget.tone.thumb,
            rim: widget.tone.rim,
            raised: widget.tone.thumbShadow,
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

  /// A glyph inside a segment's text run (`OptionStripItem.icon`).
  static const double _inlineGlyph = 16;

  /// One colour for every label; the active one is medium, as iOS sets its
  /// selected segment a weight up. The
  /// weight changes on the tap, while the thumb is still on its way — the
  /// system control does the same. [FittedBox] shrinks the longest label at
  /// the top of the Dynamic Type range (or a heavier one in a tight segment)
  /// instead of clipping it.
  Widget _label(int i) => Padding(
    padding: EdgeInsets.symmetric(horizontal: widget.tone.labelInset),
    child: Center(child: _labelText(i)),
  );

  Widget _labelText(int i) {
    final color = widget.tone.label;
    final option = widget.options[i];
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // An item's glyph rides inside the text run, so it takes the
          // label's colour and the inline 16 — not a 24pt tier glyph.
          if (option.icon != null) ...[
            Icon(option.icon, size: _inlineGlyph, color: color),
            const SizedBox(width: KalloSpacing.sp1 + 2),
          ],
          Text(
            option.label,
            maxLines: 1,
            softWrap: false,
            style: dashBody(
              color: color,
              weight:
                  i == widget.activeIndex ? FontWeight.w500 : FontWeight.w400,
            ),
          ),
          if (option.badge != null) ...[
            const SizedBox(width: KalloSpacing.sp2),
            option.badge!,
          ],
        ],
      ),
    );
  }
}
