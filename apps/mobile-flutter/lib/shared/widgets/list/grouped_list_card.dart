import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_shapes.dart';

/// A grouped list card — the Settings anchor anatomy generalized app-wide
/// (native pass, 2026-08-31): solid white, radius 22, NO border/shadow,
/// horizontal padding 16 with rows spanning edge to edge, and 1px hairline
/// separators inset to the text column.
///
/// Rows are typically [ListRow]s (56pt single-line / 64pt with subtitle),
/// but any widget works — data rows with bars use the same shell, and turn
/// [showSeparators] off because their bars already do the dividing.
class GroupedListCard extends StatelessWidget {
  const GroupedListCard({
    super.key,
    required this.children,
    this.separatorInset = 36,
    this.showSeparators = true,
  });

  /// Where a row's content starts, measured from the card's edge.
  ///
  /// Public because the card is not always the only thing that has to line up
  /// with its own column: the Circle thread page indents its replies by exactly
  /// this, so a reply's avatar lands under the post author's avatar inside the
  /// card above it (`features/circle/widgets/thread/thread_body.dart`). That
  /// used to be a second `sp4` in the thread page plus a sentence promising the
  /// two were the same number — which would have quietly stopped being true the
  /// day this padding moved.
  static const double contentInset = KalloSpacing.sp4;

  final List<Widget> children;

  /// Left inset of the separator, aligning it with the text column — 36 when
  /// rows lead with a 24pt icon (24 + 12 gap), 0 for text-only rows.
  final double separatorInset;

  /// Whether to draw the hairline between rows. Default on: a row of text
  /// needs the line, and every surface using this card except one has rows of
  /// text.
  ///
  /// The exception is a card whose rows each END in a full-width progress bar
  /// (the nutrition macro and nutrient cards). That bar's grey track already
  /// runs the width of the text column, on the same left inset the hairline
  /// would take, so the two are collinear and the line becomes a second
  /// divider stacked on the first — visible as noise, not as structure. The
  /// rule is "the bar replaces the line": turn this off ONLY where every row
  /// draws a bar, and leave it on the moment a bar-less row joins them.
  final bool showSeparators;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: contentInset),
      decoration: ShapeDecoration(
        color: kCardSurface,
        shape: KalloShapes.squircle(KalloRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0 && showSeparators)
              Container(
                height: 1,
                margin: EdgeInsets.only(left: separatorInset),
                color: kHairline,
              ),
            children[i],
          ],
        ],
      ),
    );
  }
}
