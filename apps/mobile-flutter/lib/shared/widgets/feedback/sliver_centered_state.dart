import 'package:flutter/widgets.dart';

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
class SliverCenteredState extends StatelessWidget {
  const SliverCenteredState({
    required this.child,
    this.padding = EdgeInsets.zero,
    super.key,
  });

  final Widget child;

  /// The page insets, paid inside the fill — see the note above.
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => SliverFillRemaining(
    hasScrollBody: false,
    child: Padding(padding: padding, child: Center(child: child)),
  );
}
