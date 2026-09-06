import 'package:flutter/material.dart';

import '../../../theme/kallo_theme.dart';
import 'kallo_wordmark.dart';

/// The 44pt brand row the signed-out surfaces wear: the wordmark centred, an
/// optional glyph on the leading edge, an optional quiet label on the trailing
/// one — so the mark holds still from the first screen of the flow to the last.
///
/// Centred by a [Stack], not a three-slot [Row]: the two slots differ in width
/// per language and are often absent, and in a Row the mark drifts with them.
class WordmarkBar extends StatelessWidget {
  const WordmarkBar({
    super.key,
    this.leading,
    this.trailing,
    this.gutterInset = 0,
  });

  /// The back chevron, the close glyph — whatever the host puts in the corner.
  final Widget? leading;

  /// The quiet meta on the right: "Skip", "Stay on Free".
  final Widget? trailing;

  /// Side inset, for a host whose own gutter is wider than this row wants: a
  /// 44pt target around a 24pt glyph carries 10pt of slack, and paying that
  /// back is what puts the glyph's edge on the same line as the content below.
  final double gutterInset;

  static const double rowHeight = KalloIcons.hit;
  static const double wordmarkHeight = 22;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(horizontal: gutterInset),
    child: SizedBox(
      height: rowHeight,
      child: Stack(
        children: [
          const Center(child: KalloWordmark(height: wordmarkHeight)),
          if (leading != null)
            Align(alignment: Alignment.centerLeft, child: leading!),
          if (trailing != null)
            Align(alignment: Alignment.centerRight, child: trailing!),
        ],
      ),
    ),
  );
}
