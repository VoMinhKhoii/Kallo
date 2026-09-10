import 'package:flutter/material.dart';

/// The settings tab's nested [Navigator], plus the pop plumbing that makes
/// swipe-back pop ONE level at a time.
///
/// Two page stacks are live at once: the root router's `/settings` route and
/// this nested navigator. Both wear the app's full-width back drag
/// (`shell/nav/swipe_back/`, installed app-wide through the theme), and
/// without the contract below the OUTER one would win: a swipe on a drill-in
/// never reached the inner route and instead dragged the entire settings tab,
/// popping it outright on a long drag. Measured, not assumed — and widening
/// the drag from a 20pt edge strip to the whole page only makes it easier to
/// hit.
///
/// The fix is the standard nested-navigator pop contract. While the nested
/// stack has something to pop, the settings route reports `canPop: false`;
/// that makes the outer route's `popDisposition` `doNotPop`, and
/// `ModalRoute.popGestureEnabled` — the getter the app's detector reads, the
/// same one stock Cupertino reads — then refuses to arm. With the outer
/// gesture disarmed the inner [MaterialPageRoute] owns the swipe and pops one
/// level. Back at the nested root, `canPop` flips to true and the swipe takes
/// the whole tab away again.
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
              (settings) => MaterialPageRoute<void>(
                settings: settings,
                builder: (_) => widget.root,
              ),
        ),
      ),
    );
  }
}
