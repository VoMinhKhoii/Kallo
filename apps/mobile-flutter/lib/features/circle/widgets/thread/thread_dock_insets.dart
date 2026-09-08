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
