import 'package:flutter/material.dart';

/// A sheet's own one-deep navigation: the surface stays put and its CONTENT
/// slides, so a second level never stacks a second modal on the first.
///
/// Used where a sheet has a setting worth its own page (the mode sheet's cheat
/// intensity). A nested [Navigator] is the obvious reach and the wrong one: it
/// captures the `pop(result)` the host sheet answers its caller with, and a
/// second `showNhamSheet` puts a surface, a grabber and a scrim on top of the
/// surface, grabber and scrim already there — two sheets to dismiss for one
/// choice. The reference this follows is plainly one sheet whose content
/// pushes.
///
/// The height change is animated too, since the two pages rarely agree on one:
/// without that the sheet snaps to the new height a frame before the incoming
/// page has drawn.
class SheetPageSwap extends StatelessWidget {
  const SheetPageSwap({
    super.key,
    required this.child,
    required this.isSecondLevel,
    this.duration = const Duration(milliseconds: 220),
  });

  /// The page to show. Its `key` must differ between levels, or the switcher
  /// treats the swap as a rebuild of one page and nothing animates.
  final Widget child;

  /// Which way the pages travel — forward for a push, back for a pop.
  final bool isSecondLevel;

  final Duration duration;

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: duration,
      curve: Curves.easeOutCubic,
      alignment: Alignment.topCenter,
      child: AnimatedSwitcher(
        duration: duration,
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        // The two pages are different heights; sharing a top-aligned stack
        // keeps the header still while they cross, instead of letting the
        // outgoing page's centre drag it.
        layoutBuilder: (current, previous) => Stack(
          alignment: Alignment.topCenter,
          children: [...previous, if (current != null) current],
        ),
        transitionBuilder: (child, animation) => FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween<Offset>(
              // A short travel: the page is changing, not the screen.
              begin: Offset(isSecondLevel ? 0.12 : -0.12, 0),
              end: Offset.zero,
            ).animate(animation),
            child: child,
          ),
        ),
        child: child,
      ),
    );
  }
}
