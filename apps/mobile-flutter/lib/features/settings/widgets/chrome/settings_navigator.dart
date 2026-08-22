import 'package:flutter/cupertino.dart';

/// The settings tab's nested [Navigator], plus the pop plumbing that makes
/// swipe-back pop ONE level at a time.
///
/// Two Cupertino stacks are live at once: the root router's `/settings`
/// `CupertinoPage` and this nested navigator. Each installs an edge-swipe
/// detector on the same 20px strip, and the OUTER one wins the gesture arena —
/// its detector sits above the whole subtree in hit-test order, so it is added
/// to the arena first. Measured, not assumed: with both detectors live, a
/// swipe on a drill-in never reached the inner route and instead dragged the
/// entire settings tab (popping it outright on a long drag).
///
/// The fix is the standard nested-navigator pop contract. While the nested
/// stack has something to pop, the settings route reports `canPop: false`;
/// that makes the outer route's `popDisposition` `doNotPop`, which is exactly
/// the condition Cupertino checks before arming its back gesture. With the
/// outer gesture disarmed the inner [CupertinoPageRoute] owns the swipe and
/// pops one level. Back at the nested root, `canPop` flips to true and the
/// swipe takes the whole tab away again.
///
/// The same switch routes the Android system back button into the nested stack
/// instead of closing settings from a sub-page.
class SettingsNavigator extends StatefulWidget {
  const SettingsNavigator({super.key, required this.root});

  /// The nested navigator's first route — the settings list.
  final Widget root;

  @override
  State<SettingsNavigator> createState() => _SettingsNavigatorState();
}

class _SettingsNavigatorState extends State<SettingsNavigator> {
  final GlobalKey<NavigatorState> _navigator = GlobalKey<NavigatorState>();

  /// Whether a pop should close the whole tab — true only at the nested root.
  bool _canPop = true;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _canPop,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _navigator.currentState?.maybePop();
      },
      child: NotificationListener<NavigationNotification>(
        onNotification: (notification) {
          final canPop = !notification.canHandlePop;
          if (canPop != _canPop) {
            // The notification lands mid-build (a route was just pushed or
            // popped), so defer the rebuild to the next frame.
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) setState(() => _canPop = canPop);
            });
          }
          return false; // the root navigator wants it too
        },
        child: Navigator(
          key: _navigator,
          onGenerateRoute:
              (settings) => CupertinoPageRoute<void>(
                settings: settings,
                builder: (_) => widget.root,
              ),
        ),
      ),
    );
  }
}
