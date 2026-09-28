import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/features/circle/data/moderation_mutations.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/feed_entry.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/thread_feed.dart';
import 'package:kallo_mobile/features/circle/widgets/thread/thread_body.dart';
import 'package:kallo_mobile/models/social/circle.dart';

import '../../../l10n_test_loader.dart';
import '../circle_feed_test_support.dart';

/// What the viewer sees of someone they have JUST blocked, before the refetch
/// the block started comes back: nothing to read and nothing to act on.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpL10nBinding();

  final blocked = locallyBlockedUserIdsProvider.overrideWith(
    (ref) => {'friend-s1', 'author-r1'},
  );

  testWidgets("the feed drops a blocked person's posts", (tester) async {
    await pumpCircleScreen(
      tester,
      ThreadFeed(
        feed: AsyncData(
          SharedMealFeedState(
            entries: [
              CircleFeedEntry.fromJson(entryJson('s1')),
              CircleFeedEntry.fromJson(entryJson('s2')),
            ],
            nextCursor: null,
          ),
        ),
        header: const SizedBox.shrink(),
        onRefresh: () async {},
        onRetry: () {},
        onAddFriend: () {},
      ),
      overrides: [blocked],
      expand: true,
    );

    expect(find.byType(FeedEntry), findsOneWidget);
  });

  testWidgets("a thread drops a blocked person's replies", (tester) async {
    final controller = ScrollController();
    final dock = ValueNotifier<double>(0);
    addTearDown(controller.dispose);
    addTearDown(dock.dispose);
    await pumpCircleScreen(
      tester,
      ThreadBody(
        entry: CircleFeedEntry.fromJson(
          entryJson('s2', replies: [replyJson('r1'), replyJson('r2')]),
        ),
        scope: null,
        controller: controller,
        onReply: () {},
        onRefresh: () async {},
        dockHeight: dock,
      ),
      overrides: [blocked],
      expand: true,
    );

    expect(find.text('Ngon quá!'), findsOneWidget);
  });

  testWidgets('a blocked person\'s post has no long-press menu', (
    tester,
  ) async {
    await pumpCircleScreen(
      tester,
      FeedEntry(
        entry: CircleFeedEntry.fromJson(entryJson('s1')),
        onReply: () {},
        onOpen: () {},
      ),
      overrides: [blocked],
      expand: true,
    );

    await tester.longPress(find.text('Bún chả Hà Nội'));
    await tester.pumpAndSettle();
    expect(find.text('Report post'), findsNothing);
  });
}
