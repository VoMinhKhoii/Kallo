import 'package:flutter/widgets.dart';

import '../../../theme/kallo_theme.dart';

/// A surface state (empty, failed, gone) centred in what is LEFT of the page.
///
/// [SliverFillRemaining] sizes itself from the viewport minus the extent of the
/// slivers BEFORE it, so the centre this produces is the midpoint of the space
/// under the header — not of the whole screen, and not of the state's own box.
/// A state pinned under the header with half the page blank beneath it reads as
/// content that never finished loading; this is the one placement that reads as
/// "there is nothing here".
///
/// Any bottom inset the page owes — the floating pill nav, the home indicator —
/// must be paid INSIDE this sliver via [padding]. A trailing spacer sliver
/// cannot do it: this sliver has already taken everything that was left, so
/// anything after it starts below the fold and pushes nothing.
///
/// For the same reason a page whose bottom edge is spoken for cannot pin that
/// line with a sliver of its own: [footer] hands it to this one. The state
/// still centres — in the space above the footer — and the footer holds the
/// bottom edge (the nutrition page's FAO/WHO source line is the case this
/// exists for).
class SliverCenteredState extends StatelessWidget {
  const SliverCenteredState({
    required this.child,
    this.padding = EdgeInsets.zero,
    this.footer,
    this.footerGap = KalloSpacing.sp5,
    super.key,
  });

  final Widget child;

  /// The page insets, paid inside the fill — see the note above.
  final EdgeInsetsGeometry padding;

  /// The page-owned line that keeps the bottom edge, or null when the state is
  /// all there is. It sits below [child], never scrolls out from under it.
  final Widget? footer;

  /// The gap between the centred state and [footer].
  final double footerGap;

  @override
  Widget build(BuildContext context) => SliverFillRemaining(
    hasScrollBody: false,
    child: Padding(
      padding: padding,
      child:
          footer == null
              ? Center(child: child)
              : Column(
                children: [
                  Expanded(child: Center(child: child)),
                  SizedBox(height: footerGap),
                  footer!,
                ],
              ),
    ),
  );
}
