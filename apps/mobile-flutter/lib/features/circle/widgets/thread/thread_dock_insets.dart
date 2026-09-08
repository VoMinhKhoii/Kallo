import 'package:flutter/material.dart';

/// The two insets the dock owes — the keyboard's and the home indicator's —
/// read in one leaf so their ramp rebuilds one padding.
///
/// A plain Padding, never an AnimatedPadding: iOS ramps `viewInsets` itself
/// over the keyboard's own curve, and animating on top of that lands the dock
/// a frame behind the keyboard the whole way up (see
/// `features/logging/widgets/composer/composer_dock.dart`). The home
/// indicator is already netted against the keyboard by the framework, so
/// paying both is correct rather than double-counting.
class ThreadDockInsets extends StatelessWidget {
  const ThreadDockInsets({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom:
            MediaQuery.viewInsetsOf(context).bottom +
            MediaQuery.paddingOf(context).bottom,
      ),
      child: child,
    );
  }
}
