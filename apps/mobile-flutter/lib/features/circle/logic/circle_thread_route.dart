/// The one place that knows the Circle thread page's URL shape.
///
/// The route carries the feed SCOPE alongside the share id because the page
/// reads its post out of that feed's live cache — there is no endpoint that
/// fetches a single share (`lib/domain/social/shares/replies.ts` ships replies
/// only as part of a feed page). Absent scope means the combined friends feed;
/// otherwise it is a chat-group id, exactly as `sharedMealFeedProvider` keys
/// itself.
library;

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// `/circle/thread/<shareId>[?scope=<groupId>][&compose=1]`.
///
/// `compose=1` asks the page to open its composer focused. It rides in the URL
/// rather than in a push argument so that the intent survives a deep link and
/// a restored route, exactly like [scope].
String circleThreadLocation({
  required String shareId,
  String? scope,
  bool compose = false,
}) {
  final path = '/circle/thread/${Uri.encodeComponent(shareId)}';
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
}) => GoRouter.of(
  context,
).push(circleThreadLocation(shareId: shareId, scope: scope, compose: compose));
