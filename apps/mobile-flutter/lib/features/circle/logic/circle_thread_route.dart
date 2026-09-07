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

/// `/circle/thread/<shareId>[?scope=<groupId>]`.
String circleThreadLocation({required String shareId, String? scope}) {
  final path = '/circle/thread/${Uri.encodeComponent(shareId)}';
  return scope == null
      ? path
      : '$path?scope=${Uri.encodeQueryComponent(scope)}';
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
}) => GoRouter.of(
  context,
).push(circleThreadLocation(shareId: shareId, scope: scope));
