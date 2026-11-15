/// The one place that knows the Circle thread page's URL shape.
///
/// The route carries the feed SCOPE alongside the share id because the page
/// reads its post out of that feed's live cache first, fetching the single
/// share only when no loaded feed holds it (both sources are documented in
/// `features/circle/data/thread_providers.dart`) — so the scope stays in the
/// URL because the feed is the primary read. Absent scope means the combined
/// friends feed; otherwise it is a chat-group id, exactly as
/// `sharedMealFeedProvider` keys itself.
library;

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../shell/window/window_layout.dart';
import '../data/thread_providers.dart';

/// `/circle/<shareId>[?scope=<groupId>][&compose=1]`.
///
/// `compose=1` asks the page to open its composer focused. It rides in the URL
/// rather than in a push argument so that the intent survives a deep link and
/// a restored route, exactly like [scope].
String circleThreadLocation({
  required String shareId,
  String? scope,
  bool compose = false,
}) {
  final path = '/circle/${Uri.encodeComponent(shareId)}';
  final query = <String>[
    if (scope != null) 'scope=${Uri.encodeQueryComponent(scope)}',
    if (compose) 'compose=1',
  ];
  return query.isEmpty ? path : '$path?${query.join('&')}';
}

/// Pushes the thread over the tab shell — `push`, never `go`.
///
/// `go` replaces the stack, which would leave the iOS back swipe with nothing
/// to return to and drop the feed's scroll position (same reasoning as
/// `shell/nav/nav_actions.dart`).
void openCircleThread(
  BuildContext context, {
  required String shareId,
  String? scope,
  bool compose = false,
}) {
  final router = GoRouter.of(context);
  final location = circleThreadLocation(
    shareId: shareId,
    scope: scope,
    compose: compose,
  );
  if (WindowLayout.of(context).twoPane &&
      router.state.uri.path == Uri.parse(location).path) {
    if (compose) {
      ProviderScope.containerOf(
        context,
        listen: false,
      ).read(threadFocusProvider(shareId)).requestFocus();
    }
    return;
  }
  // Beside the feed there is one detail at a time: picking another post
  // swaps the thread shown, it does not stack a second page on it. Stacked,
  // going back to the first post left two live composers for it sharing one
  // focus node, and "back" walked through every post picked.
  if (WindowLayout.of(context).twoPane &&
      router.state.pathParameters.containsKey('shareId')) {
    router.pushReplacement(location);
    return;
  }
  router.push(location);
}
