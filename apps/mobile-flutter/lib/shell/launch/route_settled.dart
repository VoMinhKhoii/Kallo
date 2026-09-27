import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../router.dart';

/// Whether the app's first screen is decided: the launch curtain's `ready`.
final launchReadyProvider = Provider<ValueListenable<bool>>((ref) {
  final settled = RouteSettled(ref.watch(routerProvider));
  ref.onDispose(settled.dispose);
  return settled;
});

/// True once [GoRouter] has left `/`, the index route the redirect holds
/// while it cannot yet say where the app starts (the session, the onboarding
/// draft or a first-session profile still loading). Past that, the screen the
/// user will land on is the one being built, so it is safe to reveal.
class RouteSettled extends ChangeNotifier implements ValueListenable<bool> {
  RouteSettled(this._router) {
    _router.routerDelegate.addListener(_update);
    _update();
  }

  final GoRouter _router;
  bool _value = false;

  @override
  bool get value => _value;

  void _update() {
    final route = _router.routerDelegate.currentConfiguration;
    // Empty before the first location is parsed; that is not settled either.
    final settled = route.isNotEmpty && route.uri.path != '/';
    if (settled == _value) return;
    _value = settled;
    notifyListeners();
  }

  @override
  void dispose() {
    _router.routerDelegate.removeListener(_update);
    super.dispose();
  }
}
