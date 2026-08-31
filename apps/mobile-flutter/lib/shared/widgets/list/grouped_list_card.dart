import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';

/// A grouped list card — the Settings anchor anatomy generalized app-wide
/// (native pass, 2026-08-31): solid white, radius 22, NO border/shadow,
/// horizontal padding 16 with rows spanning edge to edge, and 1px hairline
/// separators inset to the text column.
///
/// Rows are typically [ListRow]s (56pt single-line / 64pt with subtitle),
/// but any widget works — data rows with bars use the same shell.
class GroupedListCard extends StatelessWidget {
  const GroupedListCard({
    super.key,
    required this.children,
    this.separatorInset = 36,
  });

  final List<Widget> children;

  /// Left inset of the separator, aligning it with the text column — 36 when
  /// rows lead with a 24pt icon (24 + 12 gap), 0 for text-only rows.
  final double separatorInset;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
      decoration: BoxDecoration(
        color: kCardSurface,
        borderRadius: BorderRadius.circular(KalloRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0)
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
