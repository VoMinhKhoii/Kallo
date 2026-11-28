import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// A pre-auth screen's one sliver: [child] takes the viewport's height, or its
/// own where the window is too short for it, in a centred column no wider
/// than 420pt inside [padding].
///
/// The width cap is side padding on the sliver. As a box inside the fill it
/// was applied after the fill had asked the child for its height at the
/// window's width, where a sentence that wraps at 420pt still fits on one
/// line. On a phone on its side the Vietnamese terms line then came out a
/// line short: the email form overflowed by 16pt, and the welcome face
/// squeezed its wordmark by one.
class AuthFill extends StatelessWidget {
  const AuthFill({super.key, required this.padding, required this.child});

  /// Paid inside the fill, so the bottom inset is part of its height.
  final EdgeInsets padding;
  final Widget child;

  @override
  Widget build(BuildContext context) => SliverLayoutBuilder(
    builder:
        (context, sliver) => SliverPadding(
          padding: EdgeInsets.symmetric(
            horizontal: math.max(
              0,
              (sliver.crossAxisExtent - 420 - padding.horizontal) / 2,
            ),
          ),
          sliver: SliverFillRemaining(
            hasScrollBody: false,
            child: Padding(padding: padding, child: child),
          ),
        ),
  );
}
