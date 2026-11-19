/// Routes a tap on the home-screen widget to Today.
///
/// The widget's `widgetURL` is `nham://today` (`TodayWidgetView.swift`). The
/// same one-per-process shape as `CircleDeepLinkListener`; both subscribe to
/// `app_links`, which hands every link to every listener, and each ignores
/// the links that are not its own. Mounted by `TodayWidgetSync`.
library;

import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../router.dart';

/// The widget's tap target, and only that.
bool isTodayWidgetLink(Uri uri) => uri.scheme == 'nham' && uri.host == 'today';

class TodayWidgetLink extends ConsumerStatefulWidget {
  const TodayWidgetLink({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<TodayWidgetLink> createState() => _TodayWidgetLinkState();
}

class _TodayWidgetLinkState extends ConsumerState<TodayWidgetLink> {
  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _links;

  @override
  void initState() {
    super.initState();
    // Cold start: the link that launched the app, if it was the widget.
    unawaited(
      _appLinks.getInitialLink().then((uri) {
        if (uri != null) _open(uri);
      }),
    );
    _links = _appLinks.uriLinkStream.listen(_open, onError: (_) {});
  }

  @override
  void dispose() {
    _links?.cancel();
    super.dispose();
  }

  void _open(Uri uri) {
    if (!isTodayWidgetLink(uri)) return;
    // Next frame, so the router is mounted on a cold start. Signed out, the
    // router's redirect sends this on to sign-in like any other location.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(routerProvider).go('/dashboard');
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
