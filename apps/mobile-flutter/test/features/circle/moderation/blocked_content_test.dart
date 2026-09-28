import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/chat_group_providers.dart';
import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/features/circle/data/local_blocks.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/feed_entry.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/thread_feed.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/view_switcher.dart';
import 'package:kallo_mobile/features/circle/widgets/invite/deck/invite_deck.dart';
import 'package:kallo_mobile/features/circle/widgets/invite/meal_invites.dart';
import 'package:kallo_mobile/features/circle/widgets/thread/thread_body.dart';
import 'package:kallo_mobile/models/social/chat_group.dart';
import 'package:kallo_mobile/models/social/circle.dart';

import '../../../l10n_test_loader.dart';
import '../circle_feed_test_support.dart';

/// What the viewer sees of someone they have JUST blocked, before the refetch
/// the block started comes back: nothing to read and nothing to act on.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpL10nBinding();

  final blocked = localBlocksProvider.overrideWith(_JustBlocked.new);

  testWidgets("the feed drops a blocked person's posts", (tester) async {
    await pumpCircleScreen(
      tester,
      ThreadFeed(
        feed: AsyncData(
          SharedMealFeedState(
            entries: [
              CircleFeedEntry.fromJson(entryJson('s1')),
              CircleFeedEntry.fromJson(
                entryJson('s2', replies: [replyJson('r1'), replyJson('r2')]),
              ),
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
    // The post left standing no longer counts the blocked replier's reply.
    expect(
      tester.widget<FeedEntry>(find.byType(FeedEntry)).entry.repliesTotal,
      1,
    );
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
    // And the post's reply count no longer counts the hidden one.
    expect(
      tester.widget<FeedEntry>(find.byType(FeedEntry)).entry.repliesTotal,
      1,
    );
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

  test("the friends lists drop a blocked person's stale row", () async {
    final container = ProviderContainer(
      overrides: [
        blocked,
        circleFriendsProvider.overrideWith(
          (ref) async => [
            for (final id in ['friend-s1', 'friend-s2'])
              CircleMember.fromJson({
                'friendshipId': 'f-$id',
                'status': 'accepted',
                'profile': {'userId': id, 'handle': id, 'displayName': id},
              }),
          ],
        ),
      ],
    );
    addTearDown(container.dispose);
    final sub = container.listen(visibleCircleFriendsProvider, (_, __) {});
    addTearDown(sub.close);
    await container.read(circleFriendsProvider.future);

    final visible = container.read(visibleCircleFriendsProvider).value!;
    expect([for (final m in visible) m.profile.userId], ['friend-s2']);
  });

  group("a group pill's unread dot from a list fetched before a block", () {
    Future<void> pumpPills(WidgetTester tester, {required bool fresh}) {
      const group = ChatGroupIdentity(
        id: 'g1',
        kind: 'group',
        title: 'Weekend hikers',
        updatedAt: '2026-07-18T00:00:00Z',
        unread: true,
      );
      // `_JustBlocked` blocks at generation 1: a list asked for at 1 is
      // fresh, an unstamped one predates it.
      if (fresh) stampFetched([group], 1);
      return pumpCircleScreen(
        tester,
        const Scaffold(body: ViewSwitcher()),
        overrides: [
          blocked,
          chatGroupsProvider.overrideWith((_) => [group]),
          circleFeedProvider.overrideWith((_) => Stream.value(const [])),
          friendsReadMarkerProvider.overrideWith(
            (_) async => FriendsReadMarker(DateTime.utc(2026)),
          ),
        ],
      );
    }

    testWidgets('is held back', (tester) async {
      await pumpPills(tester, fresh: false);
      expect(find.byKey(const Key('circle-unread-dot')), findsNothing);
    });

    testWidgets('but a fresh list still shows it', (tester) async {
      await pumpPills(tester, fresh: true);
      expect(find.byKey(const Key('circle-unread-dot')), findsOneWidget);
    });
  });

  testWidgets("the All pill's unread dot ignores a blocked person's post", (
    tester,
  ) async {
    await pumpCircleScreen(
      tester,
      const Scaffold(body: ViewSwitcher()),
      overrides: [
        blocked,
        chatGroupsProvider.overrideWith(
          (_) => [
            const ChatGroupIdentity(
              id: 'g1',
              kind: 'group',
              title: 'Weekend hikers',
              updatedAt: '2026-07-18T00:00:00Z',
              unread: false,
            ),
          ],
        ),
        // The newest unread post is the blocked person's, from a frame
        // fetched before the block.
        circleFeedProvider.overrideWith(
          (_) => Stream.value([CircleFeedEntry.fromJson(entryJson('s1'))]),
        ),
        friendsReadMarkerProvider.overrideWith(
          (_) async => FriendsReadMarker(DateTime.utc(2026)),
        ),
      ],
    );

    expect(find.byKey(const Key('circle-unread-dot')), findsNothing);
  });
}

/// Two people the viewer has just blocked: the author of post `s1`, and of
/// reply `r1`.
/// Everything these tests render is unstamped, so it reads as fetched before
/// the blocks.
class _JustBlocked extends LocallyBlockedUsers {
  @override
  LocalBlocks build() => const LocalBlocks({'friend-s1': 1, 'author-r1': 1});
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
