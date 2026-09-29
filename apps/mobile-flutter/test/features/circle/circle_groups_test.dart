import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/data/chat_group_providers.dart';
import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/feed_day_group.dart';
import 'package:kallo_mobile/features/circle/widgets/feed/thread_feed.dart';
import 'package:kallo_mobile/features/circle/widgets/switcher/circle_tab.dart';
import 'package:kallo_mobile/features/circle/widgets/switcher/tab_layout.dart';
import 'package:kallo_mobile/features/circle/widgets/switcher/tab_strip.dart';
import 'package:kallo_mobile/features/circle/widgets/switcher/view_switcher.dart';
import 'package:kallo_mobile/features/circle/widgets/groups/group_face_cluster.dart';
import 'package:kallo_mobile/features/circle/widgets/groups/info/group_add_page.dart';
import 'package:kallo_mobile/features/circle/widgets/groups/info/group_info_sheet.dart';
import 'package:kallo_mobile/features/circle/widgets/invite/circle_add_menu.dart';
import 'package:kallo_mobile/models/social/chat_group.dart';
import 'package:kallo_mobile/models/social/circle.dart';
import 'package:kallo_mobile/shared/widgets/avatar/profile_avatar.dart';
import 'package:kallo_mobile/shared/widgets/menu/kallo_menu_card.dart';

import 'circle_feed_test_support.dart';
import '../../l10n_test_loader.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpL10nBinding();

  Future<void> pump(
    WidgetTester tester, {
    required AsyncValue<List<ChatGroupIdentity>> groups,
    List<CircleFeedEntry> feed = const [],
    DateTime? marker,
    DateTime? latestSharedAt,
    List<Override> extra = const [],
    Size? size,
    // Read on every fetch, for a test that changes the list and invalidates.
    List<ChatGroupIdentity> Function()? groupsOf,
  }) => pumpCircleScreen(
    tester,
    const Scaffold(body: ViewSwitcher()),
    size: size,
    overrides: [
      ...extra,
      chatGroupsProvider.overrideWith(
        (_) => groupsOf?.call() ?? groups.requireValue,
      ),
      circleFeedProvider.overrideWith((_) => Stream.value(feed)),
      friendsReadMarkerProvider.overrideWith(
        (_) async => FriendsReadMarker(
          marker ?? DateTime.utc(2026),
          latestSharedAt: latestSharedAt,
        ),
      ),
    ],
  );

  testWidgets('switcher is hidden when there are no named groups', (
    tester,
  ) async {
    await pump(tester, groups: const AsyncData([]));
    expect(find.text('All'), findsNothing);
  });

  testWidgets('renders All and group pills and selects the group', (
    tester,
  ) async {
    await pump(tester, groups: AsyncData([group(unread: false)]));
    expect(find.text('All'), findsOneWidget);
    expect(find.text('Weekend hikers'), findsOneWidget);
    await tester.tap(find.text('Weekend hikers'));
    await tester.pump();
    final scope = ProviderScope.containerOf(
      tester.element(find.byType(ViewSwitcher)),
    );
    expect(scope.read(circleSelectedViewProvider), 'g1');
  });

  // One scenario per test: re-pumping the same ProviderScope with different
  // overrides does not recompute already-resolved providers.
  testWidgets(
    'a closed group tab shows its unread dot; the open tab does not',
    (tester) async {
      await pump(
        tester,
        groups: AsyncData([group(unread: true)]),
        feed: [entry(DateTime.utc(2026, 7, 18))],
        marker: DateTime.utc(2026, 7, 17),
      );
      // "All" is the open tab, so its own dot is not drawn — the viewer is
      // reading it. The group's is.
      expect(find.byKey(const Key('circle-unread-dot')), findsOneWidget);
    },
  );

  testWidgets('unread dots hidden when read and marker newer than feed', (
    tester,
  ) async {
    await pump(
      tester,
      groups: AsyncData([group(unread: false)]),
      feed: [entry(DateTime.utc(2026, 7, 18))],
      marker: DateTime.utc(2026, 7, 19),
    );
    expect(find.byKey(const Key('circle-unread-dot')), findsNothing);
  });

  // The open tab replaced the "name · N members · (i)" line under the chips:
  // its faces say who is in the view, and a second tap opens the group.
  List<Override> openGroup({required String role, int members = 3}) => [
    circleSelectedViewProvider.overrideWith((_) => 'g1'),
    circleFriendsProvider.overrideWith((_) async => const []),
    chatGroupDetailProvider('g1').overrideWith(
      (_) async => ChatGroupDetail(
        id: 'g1',
        kind: 'group',
        name: 'Weekend hikers',
        myRole: role,
        members: [
          for (var i = 0; i < members; i++)
            ChatGroupMember(
              userId: 'u$i',
              handle: 'p$i',
              role: i == 0 ? 'owner' : 'member',
            ),
        ],
      ),
    ),
  ];

  testWidgets('a second tap on the open group tab opens the group sheet', (
    tester,
  ) async {
    await pump(
      tester,
      groups: AsyncData([group(unread: false)]),
      extra: openGroup(role: 'member'),
    );
    expect(find.byType(GroupInfoSheet), findsNothing);
    await tester.tap(find.text('Weekend hikers'));
    await tester.pumpAndSettle();
    expect(find.byType(GroupInfoSheet), findsOneWidget);
  });

  testWidgets('the open tab caps its faces to its name and counts the rest', (
    tester,
  ) async {
    await pump(
      tester,
      groups: AsyncData([group(unread: false)]),
      extra: openGroup(role: 'member', members: 9),
    );
    // Nine people never fit under one tab name: the last slot says how many
    // more there are, and the count adds up to the group.
    final more = tester.widget<Text>(find.textContaining(RegExp(r'^\+\d+$')));
    final hidden = int.parse(more.data!.substring(1));
    final shown = find.byType(ProfileAvatarDisc).evaluate().length;
    expect(shown + hidden, 9);
  });

  testWidgets('long-pressing a group tab offers only what the viewer may do', (
    tester,
  ) async {
    await pump(
      tester,
      groups: AsyncData([group(unread: false)]),
      extra: openGroup(role: 'member'),
    );
    await tester.longPress(find.text('Weekend hikers'));
    await tester.pumpAndSettle();
    expect(find.text('View group'), findsOneWidget);
    expect(find.text('Add members'), findsOneWidget);
    // Rename is the owner's.
    expect(find.text('Rename group'), findsNothing);

    await tester.tap(find.text('Add members'));
    await tester.pumpAndSettle();
    // Straight onto the sheet's second level.
    expect(find.byType(GroupAddPage), findsOneWidget);
  });

  testWidgets("the owner's long-press menu also offers rename", (tester) async {
    await pump(
      tester,
      groups: AsyncData([group(unread: false)]),
      extra: openGroup(role: 'owner'),
    );
    await tester.longPress(find.text('Weekend hikers'));
    await tester.pumpAndSettle();
    expect(find.text('Rename group'), findsOneWidget);
  });

  testWidgets('the open tab fits its name and faces at 1.3x text', (
    tester,
  ) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await pump(
      tester,
      groups: AsyncData([group(unread: false)]),
      extra: openGroup(role: 'member', members: 9),
    );
    expect(tester.takeException(), isNull);
    final tab = tester.getRect(
      find.ancestor(
        of: find.text('Weekend hikers'),
        matching: find.byType(CircleTab),
      ),
    );
    // The row's height is measured at the viewer's text scale, so the name
    // and its faces both land inside the tab.
    expect(tab.top, lessThanOrEqualTo(tester.getRect(_label).top));
    expect(tab.bottom, greaterThan(tester.getRect(_faces).bottom));
  });

  testWidgets('a one-letter tab still gets the minimum tab width', (
    tester,
  ) async {
    await pump(
      tester,
      groups: AsyncData([
        for (final name in ['A', 'B', 'C', 'D', 'E'])
          ChatGroupIdentity(
            id: name,
            kind: 'group',
            title: name,
            updatedAt: '2026-07-18T00:00:00Z',
            unread: false,
          ),
      ]),
    );
    final tab = find.ancestor(
      of: find.text('A'),
      matching: find.byType(CircleTab),
    );
    expect(
      tester.getSize(tab).width,
      greaterThanOrEqualTo(TabGeometry.minWidth),
    );
  });

  testWidgets('a held tab stays pressed once the long press takes over', (
    tester,
  ) async {
    await pump(
      tester,
      groups: AsyncData([group(unread: false)]),
      extra: openGroup(role: 'member'),
    );
    final gesture = await tester.startGesture(
      tester.getCenter(find.text('Weekend hikers')),
    );
    await tester.pump(kLongPressTimeout + const Duration(milliseconds: 100));
    // The long press has won the arena and cancelled the tap; the finger is
    // still down, so the tab must still read as pressed.
    final scale = tester.widget<AnimatedScale>(
      find
          .descendant(
            of: find.byType(CircleTab),
            matching: find.byType(AnimatedScale),
          )
          .at(1),
    );
    expect(scale.scale, lessThan(1));
    await gesture.up();
    await tester.pumpAndSettle();
  });

  testWidgets('a tab can be selected from VoiceOver', (tester) async {
    final semantics = tester.ensureSemantics();
    await pump(tester, groups: AsyncData([group(unread: false)]));
    // The tab replaces its children's semantics, so the tap must be its own.
    tester.semantics.tap(find.semantics.byLabel('Weekend hikers'));
    await tester.pump();
    final scope = ProviderScope.containerOf(
      tester.element(find.byType(ViewSwitcher)),
    );
    expect(scope.read(circleSelectedViewProvider), 'g1');
    semantics.dispose();
  });

  testWidgets('All is unread for a past-day meal shared after the marker', (
    tester,
  ) async {
    // Eaten yesterday, shared just now: the eaten-today wall does not hold
    // it, so only the marker's latestSharedAt can light the dot. A group is
    // open, so "All" is a closed tab and draws its dot (the open tab never
    // draws its own).
    await pump(
      tester,
      groups: AsyncData([group(unread: false)]),
      feed: [entry(DateTime.utc(2026, 7, 18))],
      marker: DateTime.utc(2026, 7, 19),
      latestSharedAt: DateTime.utc(2026, 7, 20),
      extra: openGroup(role: 'member'),
    );
    expect(find.byKey(const Key('circle-unread-dot')), findsOneWidget);
  });

  testWidgets('scrolling the feed away and back leaves the tab row still', (
    tester,
  ) async {
    // The switcher is the first item of the feed's lazily built list. It
    // used to be unmounted when scrolled off: back at the top it refetched
    // its faces and replayed their entrance, and the open tab's name climbed
    // ~30pt under the finger on every return.
    var fetches = 0;
    await pumpCircleScreen(
      tester,
      Scaffold(
        body: ThreadFeed(
          feed: AsyncData(
            SharedMealFeedState(
              entries: [
                for (var i = 0; i < 30; i++)
                  CircleFeedEntry.fromJson(entryJson('s$i')),
              ],
              nextCursor: null,
            ),
          ),
          header: const ViewSwitcher(),
          onRefresh: () async {},
          onRetry: () {},
          onAddFriend: () {},
        ),
      ),
      overrides: [
        chatGroupsProvider.overrideWith((_) => [group(unread: false)]),
        circleFeedProvider.overrideWith((_) => Stream.value(const [])),
        friendsReadMarkerProvider.overrideWith(
          (_) async => FriendsReadMarker(DateTime.utc(2026)),
        ),
        circleFriendsProvider.overrideWith((_) async {
          fetches++;
          // A real round trip: the faces land after the first frames.
          await Future<void>.delayed(const Duration(milliseconds: 150));
          return [
            for (var i = 0; i < 5; i++)
              CircleMember(
                friendshipId: 'f$i',
                status: 'accepted',
                profile: CircleProfile(userId: 'u$i', handle: 'p$i'),
              ),
          ];
        }),
      ],
    );
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpAndSettle();

    final feed = find.byWidgetPredicate(
      (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
    );
    final position = tester.state<ScrollableState>(feed.first).position;
    double labelTop() =>
        tester.getTopLeft(find.text('All')).dy -
        tester.getTopLeft(find.byType(ViewSwitcher)).dy;
    final restTop = labelTop();

    position.jumpTo(position.maxScrollExtent);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    position.jumpTo(0);
    for (var i = 0; i < 30; i++) {
      await tester.pump(const Duration(milliseconds: 16));
      expect(labelTop(), restTop);
    }
    expect(fetches, 1);
  });

  // Tab widths (canvas E3). `group` is this file's fixture, so no group().
  test('tabs that fit share the row equally, filling it exactly', () {
    expect(tabWidths([60, 90], 390), [195, 195]);
  });

  test('a tab wider than the share keeps its width; the rest share', () {
    final widths = tabWidths([60, 200, 80], 450);
    expect(widths, [125, 200, 125]);
    expect(widths.reduce((a, b) => a + b), 450);
  });

  test('no tab is under the minimum, and the minimums scroll', () {
    expect(tabWidths([30, 30, 30, 30], 390), [104, 104, 104, 104]);
    expect(tabWidths([30, 150, 30, 30], 390), [104, 150, 104, 104]);
  });

  test('the reveal offset brings a tab clear of the fade', () {
    final widths = <double>[104, 104, 104, 104, 104, 104];
    // Already in view: stays.
    expect(
      revealOffset(
        widths,
        1,
        current: 0,
        viewport: 390,
        maxExtent: 234,
        fade: 40,
      ),
      0,
    );
    // Under the fade: its right edge lands 40pt in from the row's edge.
    expect(
      revealOffset(
        widths,
        3,
        current: 0,
        viewport: 390,
        maxExtent: 234,
        fade: 40,
      ),
      416 - 350,
    );
    // Wider than the row: its start, where the name begins, is shown.
    expect(
      revealOffset(
        <double>[104, 500, 104],
        1,
        current: 0,
        viewport: 390,
        maxExtent: 318,
        fade: 40,
      ),
      104,
    );
    // Off the leading edge: its left edge lands on the row's.
    expect(
      revealOffset(
        widths,
        0,
        current: 100,
        viewport: 390,
        maxExtent: 234,
        fade: 40,
      ),
      0,
    );
  });

  testWidgets('one group: the two tabs share the full width', (tester) async {
    await pump(
      tester,
      groups: AsyncData(manyGroups(1)),
      size: const Size(390, 700),
    );
    final all = tester.getRect(_tab('All'));
    final group0 = tester.getRect(_tab('Group 0'));
    expect(all.left, 0);
    expect(all.width, 195);
    expect(group0.left, 195);
    expect(group0.right, 390);
    expect(tester.getSize(find.byType(ViewSwitcher)).width, 390);
    // Nothing to scroll, so no fade.
    expect(find.byKey(const Key('circle-tabs-fade')), findsNothing);
    // Each name centred in its share.
    expect(tester.getCenter(find.text('All')).dx, all.center.dx);
    expect(tester.getCenter(find.text('Group 0')).dx, group0.center.dx);
  });

  testWidgets('a name wider than its share keeps its width; the row still '
      'ends at the edge', (tester) async {
    await pump(
      tester,
      groups: AsyncData([group(unread: false)]),
      size: const Size(390, 700),
    );
    final all = tester.getRect(_tab('All'));
    final hikers = tester.getRect(_tab('Weekend hikers'));
    expect(all.left, 0);
    expect(hikers.width, greaterThan(195));
    expect(all.width, greaterThanOrEqualTo(TabGeometry.minWidth));
    expect(hikers.right, moreOrLessEquals(390));
  });

  testWidgets('many groups: the row scrolls, fades at its end, and brings '
      'the open tab into view', (tester) async {
    await pump(
      tester,
      groups: AsyncData(manyGroups(8)),
      size: const Size(390, 700),
      extra: [circleSelectedViewProvider.overrideWith((_) => 'g5')],
    );
    // Short names sit at the minimum; "Group 5" is the seventh tab, far past
    // the edge, and opens scrolled clear of the fade.
    expect(tester.getSize(_tab('All')).width, TabGeometry.minWidth);
    final open = tester.getRect(_tab('Group 5'));
    expect(open.left, greaterThanOrEqualTo(0));
    expect(open.right, lessThanOrEqualTo(390 - TabStrip.fade + 0.5));
    double fade() =>
        tester
            .widget<AnimatedOpacity>(find.byKey(const Key('circle-tabs-fade')))
            .opacity;
    expect(fade(), 1);

    // Scrolled to the end, the fade clears so the last tab reads whole.
    await tester.drag(_tab('Group 5'), const Offset(-600, 0));
    await tester.pumpAndSettle();
    expect(tester.getRect(_tab('Group 7')).right, 390);
    expect(fade(), 0);

    // Opening a tab half under the leading edge scrolls it in.
    await tester.drag(_tab('Group 7'), const Offset(330, 0));
    await tester.pumpAndSettle();
    final name = [for (var i = 0; i < 8; i++) 'Group $i'].firstWhere((name) {
      final rect = tester.getRect(_tab(name));
      return rect.left < 0 && rect.right > 0;
    });
    final partial = tester.getRect(_tab(name));
    await tester.tapAt(Offset(partial.right - 10, partial.center.dy));
    await tester.pumpAndSettle();
    expect(tester.getRect(_tab(name)).left, moreOrLessEquals(0));
  });

  testWidgets('with one group, a drag across the row does not move it', (
    tester,
  ) async {
    await pump(
      tester,
      groups: AsyncData([group(unread: false)]),
      size: const Size(390, 700),
    );
    await tester.drag(find.text('All'), const Offset(-120, 0));
    await tester.pump();
    expect(tester.getRect(_tab('All')).left, 0);
  });

  testWidgets('the open tab centres its faces under its name', (tester) async {
    await pump(
      tester,
      groups: AsyncData([group(unread: false)]),
      size: const Size(390, 700),
      extra: openGroup(role: 'member', members: 9),
    );
    final tab = tester.getRect(_tab('Weekend hikers'));
    expect(tester.getCenter(_faces).dx, moreOrLessEquals(tab.center.dx));
    expect(tester.getCenter(_label).dx, moreOrLessEquals(tab.center.dx));
    expect(
      tester.getRect(_faces).top,
      greaterThan(tester.getRect(_label).bottom),
    );
  });

  List<Override> friends(int count) => [
    circleFriendsProvider.overrideWith(
      (_) async => [
        for (var i = 0; i < count; i++)
          CircleMember(
            friendshipId: 'f$i',
            status: 'accepted',
            profile: CircleProfile(userId: 'u$i', handle: 'p$i'),
          ),
      ],
    ),
  ];

  int facesShown() =>
      find
          .descendant(of: _faces, matching: find.byType(ProfileAvatarDisc))
          .evaluate()
          .length;

  testWidgets('a minimum-width "All" shows three faces and a +N, not one', (
    tester,
  ) async {
    // The faces take the TAB's width, not the name's: "All" is three letters
    // but its tab is at least 104pt, room for four slots.
    await pump(
      tester,
      groups: AsyncData(manyGroups(8)),
      size: const Size(390, 700),
      extra: friends(12),
    );
    expect(tester.getSize(_tab('All')).width, TabGeometry.minWidth);
    expect(facesShown(), 3);
    expect(find.text('+9'), findsOneWidget);
    expect(
      tester.getSize(_faces).width,
      lessThanOrEqualTo(TabGeometry.minWidth - 2 * TabGeometry.sidePad),
    );
  });

  testWidgets('a half-width tab shows five slots, inside its share', (
    tester,
  ) async {
    await pump(
      tester,
      groups: AsyncData(manyGroups(1)),
      size: const Size(390, 700),
      extra: friends(12),
    );
    expect(tester.getSize(_tab('All')).width, 195);
    expect(facesShown(), 4);
    expect(find.text('+8'), findsOneWidget);
    final tab = tester.getRect(_tab('All'));
    final faces = tester.getRect(_faces);
    expect(faces.left, greaterThanOrEqualTo(tab.left + TabGeometry.sidePad));
    expect(faces.right, lessThanOrEqualTo(tab.right - TabGeometry.sidePad));
  });

  testWidgets('right to left, the row fades at its left edge', (tester) async {
    await pumpCircleScreen(
      tester,
      const Scaffold(
        body: Directionality(
          textDirection: TextDirection.rtl,
          child: ViewSwitcher(),
        ),
      ),
      size: const Size(390, 700),
      overrides: [
        chatGroupsProvider.overrideWith((_) => manyGroups(8)),
        circleFeedProvider.overrideWith((_) => Stream.value(const [])),
        friendsReadMarkerProvider.overrideWith(
          (_) async => FriendsReadMarker(DateTime.utc(2026)),
        ),
      ],
    );
    // "All" leads on the right; the fade covers the trailing, left, edge.
    expect(tester.getRect(_tab('All')).right, 390);
    final fade = tester.getRect(find.byKey(const Key('circle-tabs-fade')));
    expect(fade.left, 0);
    expect(fade.width, TabStrip.fade);
  });

  testWidgets('a tab keeps its width when its unread flag clears', (
    tester,
  ) async {
    // Opening an unread group refetches the list a moment later with the
    // flag off; the open tab never draws the dot, so it must not resize.
    var unread = true;
    await pump(
      tester,
      groups: AsyncData([group(unread: true)]),
      size: const Size(390, 700),
      groupsOf: () => [group(unread: unread)],
    );
    List<Rect> rects() => [
      for (final name in ['All', 'Weekend hikers']) tester.getRect(_tab(name)),
    ];
    final before = rects();
    unread = false;
    ProviderScope.containerOf(
      tester.element(find.byType(ViewSwitcher)),
    ).invalidate(chatGroupsProvider);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('circle-unread-dot')), findsNothing);
    expect(rects(), before);
  });

  testWidgets('a narrower row brings the open tab back into view', (
    tester,
  ) async {
    await pump(
      tester,
      groups: AsyncData(manyGroups(8)),
      size: const Size(390, 700),
      extra: [circleSelectedViewProvider.overrideWith((_) => 'g2')],
    );
    expect(
      tester.getRect(_tab('Group 2')).right,
      lessThanOrEqualTo(390 - TabStrip.fade + 0.5),
    );
    // Rotated or resized: the same tab stays open, nothing re-selects it.
    tester.view.physicalSize = const Size(300, 700);
    await tester.pumpAndSettle();
    final open = tester.getRect(_tab('Group 2'));
    expect(open.left, greaterThanOrEqualTo(0));
    expect(open.right, lessThanOrEqualTo(300 - TabStrip.fade + 0.5));
  });

  testWidgets('renaming the open tab keeps its start in view', (tester) async {
    var title = 'Group 5';
    await pump(
      tester,
      groups: AsyncData(manyGroups(8)),
      size: const Size(390, 700),
      extra: [circleSelectedViewProvider.overrideWith((_) => 'g5')],
      groupsOf:
          () => [
            for (final g in manyGroups(8))
              g.id == 'g5'
                  ? ChatGroupIdentity(
                    id: 'g5',
                    kind: 'group',
                    title: title,
                    updatedAt: g.updatedAt,
                    unread: false,
                  )
                  : g,
          ],
    );
    title = 'Our long running Sunday lunch group';
    ProviderScope.containerOf(
      tester.element(find.byType(ViewSwitcher)),
    ).invalidate(chatGroupsProvider);
    await tester.pumpAndSettle();
    // Wider than the row itself: its start, where the name begins, shows.
    expect(tester.getRect(_tab(title)).left, moreOrLessEquals(0));
  });

  testWidgets('opening a tab never moves the row, the tabs, or the feed', (
    tester,
  ) async {
    await pump(
      tester,
      groups: AsyncData([group(unread: false), ...manyGroups(1)]),
      // Wide enough that nothing scrolls: a scroll-into-view is not a jump.
      size: const Size(520, 700),
      extra: openGroup(role: 'member', members: 9)..removeAt(0),
    );
    List<Rect> rects() => [
      tester.getRect(find.byType(ViewSwitcher)),
      for (final name in ['All', 'Weekend hikers', 'Group 0'])
        tester.getRect(_tab(name)),
    ];
    final before = rects();
    await tester.tap(_label);
    // Every frame of the opening, and after the faces land.
    for (var i = 0; i < 40; i++) {
      await tester.pump(const Duration(milliseconds: 16));
      expect(rects(), before);
    }
    await tester.pumpAndSettle();
    expect(find.byType(GroupFaceCluster), findsOneWidget);
    expect(rects(), before);
  });

  testWidgets('the unread dot is small and raised beside the name', (
    tester,
  ) async {
    await pump(tester, groups: AsyncData([group(unread: true)]));
    final dot = tester.getRect(find.byKey(const Key('circle-unread-dot')));
    final label = tester.getRect(_label);
    expect(dot.size, const Size.square(6));
    expect(dot.left - label.right, 3);
    expect(dot.center.dy, lessThan(label.center.dy));
  });

  testWidgets('in the feed, the tab row runs edge to edge while the posts '
      'keep the page inset', (tester) async {
    await pumpCircleScreen(
      tester,
      Scaffold(
        body: ThreadFeed(
          feed: AsyncData(
            SharedMealFeedState(
              entries: [CircleFeedEntry.fromJson(entryJson('s1'))],
              nextCursor: null,
            ),
          ),
          header: const ViewSwitcher(),
          onRefresh: () async {},
          onRetry: () {},
          onAddFriend: () {},
        ),
      ),
      size: const Size(390, 700),
      overrides: [
        chatGroupsProvider.overrideWith((_) => [group(unread: false)]),
        circleFeedProvider.overrideWith((_) => Stream.value(const [])),
        friendsReadMarkerProvider.overrideWith(
          (_) async => FriendsReadMarker(DateTime.utc(2026)),
        ),
        circleFriendsProvider.overrideWith((_) async => const []),
      ],
    );
    final row = tester.getRect(find.byType(ViewSwitcher));
    expect(row.left, 0);
    expect(row.width, 390);
    // Tappable at the very edge, not just painted there.
    await tester.tapAt(Offset(389, row.center.dy));
    await tester.pump();
    final scope = ProviderScope.containerOf(
      tester.element(find.byType(ViewSwitcher)),
    );
    expect(scope.read(circleSelectedViewProvider), 'g1');
    final day = tester.getRect(find.byType(FeedDayGroup));
    expect(day.left, 12);
    expect(day.right, 390 - 12);
  });

  // The header's add control is an ANCHORED POPOVER (native pass,
  // 2026-08-31), not the Cupertino action sheet it replaced: the card hangs
  // off the button that opened it, so the eye never leaves the corner it
  // touched. Housed in this file rather than its own so the suite gains no
  // extra parallel isolate — `test/services/billing/entitlements_test.dart`
  // polls against 20-50ms of REAL time and misses its window under one more
  // concurrent test file. That fragility is its own to fix.
  Future<void> pumpMenu(WidgetTester tester) => pumpCircleScreen(
    tester,
    const Scaffold(
      body: Align(alignment: Alignment.topRight, child: CircleAddMenu()),
    ),
  );

  testWidgets('the add popover opens under the button with two grouped rows', (
    tester,
  ) async {
    await pumpMenu(tester);
    expect(find.byType(KalloMenuActionRow), findsNothing);

    final button = tester.getRect(find.byType(CircleAddMenu));
    await tester.tap(find.byType(CircleAddMenu));
    await tester.pumpAndSettle();

    expect(find.text('Add friend'), findsOneWidget);
    expect(find.text('Create group'), findsOneWidget);

    // Hanging BELOW the button and aligned to its right edge — the whole
    // point of an anchored menu over a bottom sheet.
    final row = tester.getRect(find.byType(KalloMenuActionRow).first);
    expect(row.top, greaterThan(button.bottom));
    expect(row.right, lessThanOrEqualTo(button.right));

    // One menu anatomy, app-wide: 44pt full-bleed rows on the 240 card — no
    // side padding of their own, so the press wash runs edge to edge.
    expect(row.width, closeTo(kKalloMenuWidth, 0.5));
    expect(row.height, closeTo(kKalloMenuRowHeight, 0.5));
    // The whole row is tappable, not just its label.
    for (final widget in tester.widgetList<KalloMenuActionRow>(
      find.byType(KalloMenuActionRow),
    )) {
      expect(widget.onTap, isNotNull);
    }
  });

  testWidgets('tapping the scrim dismisses the add popover', (tester) async {
    await pumpMenu(tester);
    await tester.tap(find.byType(CircleAddMenu));
    await tester.pumpAndSettle();
    expect(find.byType(KalloMenuActionRow), findsNWidgets(2));

    // Bottom-left is scrim, well clear of the card in the top-right corner.
    await tester.tapAt(const Offset(20, 500));
    await tester.pumpAndSettle();
    expect(find.byType(KalloMenuActionRow), findsNothing);
  });
}

final _label = find.text('Weekend hikers');

Finder _tab(String name) =>
    find.ancestor(of: find.text(name), matching: find.byType(CircleTab));

List<ChatGroupIdentity> manyGroups(int count) => [
  for (var i = 0; i < count; i++)
    ChatGroupIdentity(
      id: 'g$i',
      kind: 'group',
      title: 'Group $i',
      updatedAt: '2026-07-18T00:00:00Z',
      unread: false,
    ),
];
final _faces = find.byType(GroupFaceCluster);

ChatGroupIdentity group({required bool unread}) => ChatGroupIdentity(
  id: 'g1',
  kind: 'group',
  title: 'Weekend hikers',
  updatedAt: '2026-07-18T00:00:00Z',
  unread: unread,
);

CircleFeedEntry entry(DateTime sharedAt) => CircleFeedEntry(
  friend: const CircleProfile(userId: 'u2', handle: 'mai'),
  isSelf: false,
  meal: CircleFeedMeal(
    mealId: 'm1',
    shareId: 's1',
    rawInput: 'Phở',
    sharedAt: sharedAt.toIso8601String(),
  ),
);
