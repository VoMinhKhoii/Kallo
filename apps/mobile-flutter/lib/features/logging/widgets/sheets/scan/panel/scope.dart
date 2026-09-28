import 'package:flutter/widgets.dart';

/// What the sheet's own gestures do on the page showing now: a drag down or a
/// tap outside closes it ([onDismiss]), a swipe right goes back a level
/// ([onBack]). Null is "not now" (a save in flight) or "no such level".
///
/// Mutable on purpose: the page writes them while it builds — the sheet built
/// before it, so it cannot read them as parameters — and the sheet reads them
/// only when a gesture lands, long after that build.
class ScanSheetCallbacks {
  VoidCallback? onDismiss;
  VoidCallback? onBack;
}

/// Hands the page its sheet's [ScanSheetCallbacks]. A page on its way out gets
/// a detached set, so what it writes while it slides away can never take the
/// gestures from the page arriving.
class ScanSheetScope extends InheritedWidget {
  const ScanSheetScope({
    super.key,
    required this.callbacks,
    required super.child,
  });

  final ScanSheetCallbacks callbacks;

  static ScanSheetCallbacks? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<ScanSheetScope>()?.callbacks;

  @override
  bool updateShouldNotify(ScanSheetScope oldWidget) =>
      oldWidget.callbacks != callbacks;
}
