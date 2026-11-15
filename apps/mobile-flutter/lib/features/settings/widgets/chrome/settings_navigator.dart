import 'package:flutter/material.dart';
import '../../../../shell/window/two_pane_transition.dart';
import '../../../../shell/window/window_layout.dart';
import '../../../../shared/widgets/panes/detail_pane_route.dart';
import '../../screens/steps/about_you_page.dart';
import 'settings_selection.dart';

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

  static Type? selectedOf(BuildContext context) {
    final selected = SettingsSelection.of(context);
    return WindowLayout.of(context).twoPane ? selected : null;
  }

  @override
  State<SettingsNavigator> createState() => _SettingsNavigatorState();
}

class _SettingsNavigatorState extends State<SettingsNavigator>
    with TwoPaneTransition {
  final GlobalKey<NavigatorState> _navigator = GlobalKey<NavigatorState>();
  final _selected = ValueNotifier<Type?>(null);

  @override
  void dispose() {
    _selected.dispose();
    super.dispose();
  }

  Future<void> open(Widget page) async {
    final navigator = _navigator.currentState!;
    if (replacesDetail(context, hasDetail: navigator.canPop())) {
      if (_selected.value == page.runtimeType) return;
      if (!await navigator.maybePop()) return;
    }
    _selected.value = page.runtimeType;
    await navigator.push(DetailPaneRoute<void>(builder: (_) => page));
    if (mounted && !navigator.canPop()) _selected.value = null;
  }

  /// Beside the list the detail pane is never empty: a two-pane window at
  /// the nested root opens About you. That is checked when the window becomes
  /// two panes (including a first mount in one) and when the stack is back at
  /// its root, a frame after each, once the navigator has settled.
  @override
  void onTwoPaneChanged(bool wasTwoPane) {
    if (!wasTwoPane) _openFirstDetail();
  }

  void _openFirstDetail() {
    if (_canPop && !_navigator.currentState!.canPop()) {
      open(const AboutYouPage());
    }
  }

  /// Whether a pop should close the whole tab — true only at the nested root.
  bool _canPop = true;

  @override
  Widget build(BuildContext context) {
    return SettingsSelection(
      notifier: _selected,
      child: PopScope(
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
                if (!mounted) return;
                setState(() => _canPop = canPop);
                if (canPop && WindowLayout.of(context).twoPane) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted) _openFirstDetail();
                  });
                }
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
      ),
    );
  }
}

/// Pushes [page] one level down the settings stack.
///
/// Uses the app's Material transition in compact windows. A transparent route
/// keeps the root list visible and interactive beside the detail in wide ones.
void pushSettingsPage(BuildContext context, Widget page) {
  final owner = context.findAncestorStateOfType<_SettingsNavigatorState>();
  if (owner != null) {
    owner.open(page);
  } else {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));
  }
}
