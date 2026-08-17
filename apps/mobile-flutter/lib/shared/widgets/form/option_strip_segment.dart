import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import 'option_strip.dart' show OptionStripItem, OptionStripSkin;

/// Everything NOT here was already identical between the copies: the `track`
/// container at radius 12 with 4px inner padding, the active chip (`elev` fill,
/// `shadow.sm`, radius 8), the 150ms transition and the ink/muted colour rule.
class OptionStripSkinSpec {
  const OptionStripSkinSpec._({
    required this.stretchToTallest,
    required this.padding,
    required this.curve,
    required this.hintGap,
    required this.hintMaxLines,
    required this.hitTest,
    required this.alignment,
    required this.announceAsButton,
  });

  /// Settings runs the row through [IntrinsicHeight] so a one-line option
  /// matches a two-line one; onboarding lets each segment size itself.
  final bool stretchToTallest;
  final EdgeInsets padding;
  final Curve curve;
  final double hintGap;

  /// Onboarding clamps the hint to two lines; settings lets it run.
  final int? hintMaxLines;
  final HitTestBehavior hitTest;

  /// Null leaves the chip's child on tight constraints (full segment width, so
  /// a hint wraps); centring makes it shrink-wrap instead.
  final Alignment? alignment;

  /// Only settings exposes a segment as a selectable button to the a11y tree —
  /// adding it to onboarding would change what a screen reader says.
  final bool announceAsButton;

  static const _onboarding = OptionStripSkinSpec._(
    stretchToTallest: false,
    padding: EdgeInsets.symmetric(
      horizontal: KalloSpacing.sp2, // px-2
      vertical: KalloSpacing.sp2_5, // py-2.5
    ),
    curve: Cubic(0.25, 0.1, 0.25, 1),
    hintGap: KalloSpacing.sp1, // mt-1
    hintMaxLines: 2, // line-clamp-2
    hitTest: HitTestBehavior.opaque,
    alignment: null,
    announceAsButton: false,
  );

  static const _settings = OptionStripSkinSpec._(
    stretchToTallest: true,
    padding: EdgeInsets.symmetric(vertical: KalloSpacing.sp2), // py-2
    curve: Curves.linear,
    hintGap: 2, // mt-0.5
    hintMaxLines: null,
    hitTest: HitTestBehavior.deferToChild,
    alignment: Alignment.center,
    announceAsButton: true,
  );

  static OptionStripSkinSpec of(OptionStripSkin skin) =>
      skin == OptionStripSkin.settings ? _settings : _onboarding;
}

/// One button of an [OptionStrip], drawn to the given [OptionStripSkinSpec].
class OptionStripSegment extends StatefulWidget {
  const OptionStripSegment({
    super.key,
    required this.item,
    required this.active,
    required this.onTap,
    required this.skin,
  });

  final OptionStripItem item;
  final bool active;
  final VoidCallback onTap;
  final OptionStripSkinSpec skin;

  @override
  State<OptionStripSegment> createState() => _SegmentState();
}

class _SegmentState extends State<OptionStripSegment> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final s = widget.skin;
    final item = widget.item;
    // active #2C2416, inactive #8B8682; press darkens inactive toward ink.
    final color = widget.active || _pressed ? kInk : kInkMuted;

    final button = GestureDetector(
      behavior: s.hitTest,
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150), // transition-all
        curve: s.curve,
        alignment: s.alignment,
        padding: s.padding,
        decoration: BoxDecoration(
          color: widget.active ? KalloColors.elev : Colors.transparent,
          borderRadius: BorderRadius.circular(KalloRadii.md),
          boxShadow: widget.active ? const [KalloShadows.sm] : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // `flex items-center gap-1.5`, both in currentColor.
            Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (item.icon != null) ...[
                  Icon(item.icon, size: 14, color: color), // size-3.5
                  const SizedBox(width: 6), // gap-1.5
                ],
                Flexible(
                  child: Text(
                    item.label,
                    textAlign: TextAlign.center,
                    style: dashBody(color: color, weight: FontWeight.w500),
                  ),
                ),
              ],
            ),
            if (item.hint != null)
              Padding(
                padding: EdgeInsets.only(top: s.hintGap),
                child: Text(
                  item.hint!,
                  textAlign: TextAlign.center,
                  maxLines: s.hintMaxLines,
                  overflow:
                      s.hintMaxLines == null
                          ? TextOverflow.clip
                          : TextOverflow.ellipsis,
                  style: dashMeta(color: color.withValues(alpha: 0.7)),
                ),
              ),
          ],
        ),
      ),
    );

    if (!s.announceAsButton) return button;
    return Semantics(
      button: true,
      selected: widget.active,
      excludeSemantics: true,
      label: item.hint == null ? item.label : '${item.label}, ${item.hint}',
      onTap: widget.onTap,
      child: button,
    );
  }
}
