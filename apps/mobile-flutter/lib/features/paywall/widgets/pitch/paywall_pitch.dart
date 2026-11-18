import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../shell/window/window_layout.dart';
import '../../../../theme/kallo_theme.dart';
import '../paywall_gutter.dart';
import 'paywall_guide.dart';
import 'plan_comparison.dart';

/// The half of the paywall that scrolls: the bun's line, the title and the
/// toggle over the table, or the table alone beside the decision.
///
/// It scrolls, and only this half does: with the system text size turned up
/// the table outgrows any phone, and it is the half a user can afford to go
/// looking for (see `PaywallBuyBand`).
///
/// On a tall phone the table would stop short of the buy band and leave a
/// void under it, so the table takes whatever height is left instead
/// ([SliverFillRemaining]) and spreads its rows to fill it. When the content
/// is taller than the screen, it simply scrolls.
class PaywallPitch extends StatelessWidget {
  const PaywallPitch({
    required this.controller,
    this.header,
    this.guideLine,
    this.toggle,
    super.key,
  });

  final ScrollController controller;

  /// The close glyph and the wordmark, in a window too short to pin them.
  final Widget? header;

  /// What the bun says. Null beside the decision, which carries the title
  /// and the toggle itself: the pitch is then the table alone, centred on the
  /// window's height and running down to its bottom edge.
  final String? guideLine;

  /// The period toggle; null when the offering has one period.
  final Widget? toggle;

  /// The height the bun, the title, the toggle and all eight rows need at
  /// their regular spacing: about 505 at default text, where a 402pt phone
  /// gives 543. Under it the pitch closes up instead of hiding the last rows
  /// behind the band: tighter gaps, denser rows, and the title without the
  /// bun.
  static const double fullHeight = 520;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, bounds) {
      final tight = bounds.maxHeight < fullHeight;
      final alone = guideLine == null;
      final insets = MediaQuery.viewPaddingOf(context);
      final width = bounds.maxWidth - insets.horizontal;
      final side = PaywallGutter.of(context);
      final table = PlanComparison(
        availableWidth: math.min(420, width - 2 * side),
        dense: tight,
      );
      // Large text needs the table's natural height in the bounded column; a
      // flex allocation can be shorter than its wrapped rows.
      final natural =
          WindowLayout.of(context).foldAcross &&
          MediaQuery.textScalerOf(context).scale(16) > 16;
      final column = Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!alone) ...[
            if (tight) PaywallGuide.title() else PaywallGuide(line: guideLine!),
            SizedBox(height: tight ? KalloSpacing.sp2 : KalloSpacing.sp3_5),
            if (toggle != null) ...[
              toggle!,
              SizedBox(height: tight ? KalloSpacing.sp2 : KalloSpacing.sp2_5),
            ],
          ],
          // Beside the decision the table is centred at its own height.
          if (natural || alone) table else Expanded(child: table),
        ],
      );
      // The padding goes INSIDE the fill, not around it as a SliverPadding:
      // SliverFillRemaining fills whatever is left of the viewport, so a
      // SliverPadding's bottom inset landed below the fold, the card ran
      // flush into the buy band and the page scrolled by that inset.
      final body = Padding(
        padding: EdgeInsets.fromLTRB(
          side + insets.left,
          tight ? KalloSpacing.sp1 : KalloSpacing.sp2,
          side + insets.right,
          // Over the band, the clean gap above it. Alone the table is
          // centred, so it only has to clear the home indicator.
          alone ? KalloSpacing.sp2 + insets.bottom : KalloSpacing.sp4,
        ),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: column,
          ),
        ),
      );
      return CustomScrollView(
        controller: controller,
        slivers: [
          if (header != null) SliverToBoxAdapter(child: header),
          if (natural)
            SliverToBoxAdapter(child: body)
          else
            SliverFillRemaining(hasScrollBody: false, child: body),
        ],
      );
    },
  );
}
