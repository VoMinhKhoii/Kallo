import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// The two insets the bottom of the thread page owes: the keyboard's
/// (`viewInsets`) and the home indicator's (`padding`).
///
/// Both, and not one or the other: the home indicator is already netted
/// against the keyboard by the framework, so paying the pair is correct rather
/// than double-counting. Two callers owe exactly this sum and must move on the
/// same frame — [ThreadDockInsets] pads the dock by it, and the body's tail
/// reserve adds it under the dock's own reported height.
///
/// Read it in the smallest widget that can: it rebuilds whatever reads it on
/// every frame of the keyboard's ~250ms ramp.
double threadDockInsets(BuildContext context) =>
    MediaQuery.viewInsetsOf(context).bottom +
    MediaQuery.paddingOf(context).bottom;

/// [threadDockInsets] as the dock's own bottom padding, read in one leaf so
/// the keyboard's ramp rebuilds one padding and not the field above it.
///
/// A plain Padding, never an AnimatedPadding: iOS ramps `viewInsets` itself
/// over the keyboard's own curve, and animating on top of that lands the dock
/// a frame behind the keyboard the whole way up (see
/// `features/logging/widgets/composer/composer_dock.dart`).
class ThreadDockInsets extends StatelessWidget {
  const ThreadDockInsets({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: threadDockInsets(context)),
      child: child,
    );
  }
}

/// The room the body's last row needs to clear the dock.
///
/// Its own widget so the keyboard's ramp and a grown dock rebuild THIS and
/// nothing else: the dock pays the keyboard and home-indicator insets itself
/// and reports only its own height, so the body owes all three — read here,
/// through the dock's own [threadDockInsets], so the two stay the same number
/// and still move on the same frame.
///
/// A [Padding] inside the sliver rather than a [SliverPadding] around it: the
/// scroll view is a [CustomScrollView] now (the pull-to-refresh control is a
/// sliver), and a sliver's padding is a constructor argument, so paying the
/// tail out there would rebuild the whole sliver list on every frame of the
/// keyboard's ~250ms ramp. Inside, with [child] handed through, the post and
/// every reply survive the ramp untouched.
///
/// It is also what keeps the empty state centred in the VISIBLE void: inside a
/// [SliverCenteredState] this padding shrinks the box the state centres in, so
/// the capybara sits in the middle of the gap above the composer rather than
/// in the middle of the gap behind it.
class ThreadDockTail extends StatelessWidget {
  const ThreadDockTail({
    required this.dockHeight,
    required this.child,
    this.extra = 0,
    super.key,
  });

  /// What the docked composer currently covers, measured rather than assumed.
  final ValueListenable<double> dockHeight;

  /// The page's own break below the content, on top of the dock's own extent.
  final double extra;

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final insets = threadDockInsets(context);
    return ValueListenableBuilder<double>(
      valueListenable: dockHeight,
      child: child,
      builder:
          (context, dock, child) => Padding(
            padding: EdgeInsets.only(bottom: dock + insets + extra),
            child: child,
          ),
    );
  }
}
