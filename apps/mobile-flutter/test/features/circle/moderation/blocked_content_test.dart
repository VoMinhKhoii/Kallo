import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/features/circle/data/local_blocks.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/feed_entry.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/thread_feed.dart';
import 'package:kallo_mobile/features/circle/widgets/invite/deck/invite_deck.dart';
import 'package:kallo_mobile/features/circle/widgets/invite/meal_invites.dart';
import 'package:kallo_mobile/features/circle/widgets/thread/thread_body.dart';
import 'package:kallo_mobile/models/social/circle.dart';

import '../../../l10n_test_loader.dart';
import '../circle_feed_test_support.dart';

/// What the viewer sees of someone they have JUST blocked, before the refetch
/// the block started comes back: nothing to read and nothing to act on.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpL10nBinding();

  final blocked = locallyBlockedUserIdsProvider.overrideWith(_JustBlocked.new);

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

  testWidgets("a blocked person's meal offers leave the inbox", (tester) async {
    await pumpCircleScreen(
      tester,
      const SingleChildScrollView(child: MealInvitesSection()),
      overrides: [
        blocked,
        mealShareInvitesProvider.overrideWith(
          (ref) async => [offer('i1', 'friend-s1')],
        ),
      ],
      expand: true,
    );

    expect(find.byType(InviteDeck), findsNothing);
  });

  test('the Circle badge reads the same filtered inbox', () async {
    final container = ProviderContainer(
      overrides: [
        blocked,
        mealShareInvitesProvider.overrideWith(
          (ref) async => [offer('i1', 'friend-s1'), offer('i2', 'friend-s2')],
        ),
      ],
    );
    addTearDown(container.dispose);
    final sub = container.listen(visibleMealShareInvitesProvider, (_, __) {});
    addTearDown(sub.close);
    await container.read(mealShareInvitesProvider.future);

    final visible = container.read(visibleMealShareInvitesProvider).value!;
    expect([for (final i in visible) i.id], ['i2']);
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

/// Two people the viewer has just blocked: the author of post `s1`, and of
/// reply `r1`.
class _JustBlocked extends LocallyBlockedUsers {
  @override
  Set<String> build() => {'friend-s1', 'author-r1'};
}

/// A copy offer of [id] from [from].
MealShareInvite offer(String id, String from) => MealShareInvite.fromJson({
  'id': id,
  'mode': 'copy',
  'portionFactor': 1,
  'createdAt': '2026-09-28T10:00:00.000Z',
  'from': {'userId': from, 'handle': from, 'displayName': from},
  'meal': {
    'rawInput': 'Trà sữa',
    'caloriesKcal': 100,
    'proteinG': 2,
    'carbohydrateG': 20,
    'fatG': 2.5,
  },
});
