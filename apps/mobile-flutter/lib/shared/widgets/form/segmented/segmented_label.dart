import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// One segment's words in a [SegmentedStrip], with what a finger does to
/// them — iOS's rules: the label under the thumb is a weight up and shrinks
/// with a held thumb ([scale], toward [anchor]); a pressed label beside the
/// thumb fades to [pressedOpacity] over 470ms, and back as the finger lifts.
///
/// [FittedBox] shrinks the longest label at the top of the Dynamic Type range
/// instead of clipping it.
class SegmentedLabel extends StatelessWidget {
  const SegmentedLabel({
    required this.label,
    required this.color,
    required this.selected,
    required this.pressed,
    required this.scale,
    required this.anchor,
    required this.inset,
    this.icon,
    this.badge,
    super.key,
  });

  final String label;
  final IconData? icon;
  final Widget? badge;
  final Color color;
  final bool selected, pressed;
  final double scale;
  final Alignment anchor;

  /// Room either side of the words, for a strip sized to them.
  final double inset;

  static const double pressedOpacity = 0.2;
  static const Duration _fade = Duration(milliseconds: 470);

  /// A glyph inside the text run: the inline 16, not a 24pt tier glyph.
  static const double _inlineGlyph = 16;

  @override
  Widget build(BuildContext context) => AnimatedOpacity(
    opacity: pressed && !selected ? pressedOpacity : 1,
    duration: _fade,
    curve: Curves.ease,
    child: Transform.scale(
      scale: scale,
      alignment: anchor,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: inset),
        child: Center(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: _inlineGlyph, color: color),
                  const SizedBox(width: KalloSpacing.sp1 + 2),
                ],
                Text(
                  label,
                  maxLines: 1,
                  softWrap: false,
                  style: dashBody(
                    color: color,
                    weight: selected ? FontWeight.w500 : FontWeight.w400,
                  ),
                ),
                if (badge != null) ...[
                  const SizedBox(width: KalloSpacing.sp2),
                  badge!,
                ],
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
