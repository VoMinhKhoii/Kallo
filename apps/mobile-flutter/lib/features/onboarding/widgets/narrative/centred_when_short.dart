import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// Inside a scroll view: a [child] shorter than [height] sits in the middle
/// of it, and a taller one starts at the top and scrolls as before.
///
/// The two halves of an onboarding step beside the fold both use it, so a
/// short question and a short answer meet on one line across the fold.
class CentredWhenShort extends StatelessWidget {
  const CentredWhenShort({
    super.key,
    required this.height,
    required this.child,
  });

  /// The visible height the scroll view has for its content.
  final double height;
  final Widget child;

  @override
  Widget build(BuildContext context) => ConstrainedBox(
    constraints: BoxConstraints(minHeight: math.max(0, height)),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [child],
    ),
  );
}
