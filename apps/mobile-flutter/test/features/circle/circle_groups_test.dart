import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/data/chat_group_providers.dart';
import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/circle/data/feed_providers.dart';
import 'package:kallo_mobile/features/circle/widgets/switcher/circle_tab.dart';
import 'package:kallo_mobile/features/circle/widgets/switcher/view_switcher.dart';
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
  }) => pumpCircleScreen(
    tester,
    const Scaffold(body: ViewSwitcher()),
    overrides: [
      ...extra,
      chatGroupsProvider.overrideWith((_) => groups.requireValue),
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

  testWidgets('the open tab grows instead of overflowing at 1.3x text', (
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
    final tab = find.ancestor(
      of: find.text('Weekend hikers'),
      matching: find.byType(CircleTab),
    );
    expect(tester.getSize(tab).height, greaterThan(CircleTab.height));
  });

  testWidgets('a one-letter tab still offers a 44pt target', (tester) async {
    await pump(
      tester,
      groups: const AsyncData([
        ChatGroupIdentity(
          id: 'g2',
          kind: 'group',
          title: 'A',
          updatedAt: '2026-07-18T00:00:00Z',
          unread: false,
        ),
      ]),
    );
    final tab = find.ancestor(
      of: find.text('A'),
      matching: find.byType(CircleTab),
    );
    expect(tester.getSize(tab).width, greaterThanOrEqualTo(44));
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
