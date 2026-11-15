import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kallo_mobile/features/circle/logic/circle_thread_route.dart';
import 'package:kallo_mobile/features/circle/screens/circle_screen.dart';
import 'package:kallo_mobile/features/circle/screens/circle_thread_screen.dart';
import 'package:kallo_mobile/features/circle/widgets/thread/thread_composer.dart';
import 'package:kallo_mobile/features/circle/widgets/thread/reply_pill.dart';
import 'package:kallo_mobile/features/settings/widgets/chrome/settings_step_page.dart';
import 'package:kallo_mobile/features/settings/screens/steps/goal_pace_page.dart';
import 'package:kallo_mobile/features/settings/screens/account_delete_screen.dart';
import 'package:kallo_mobile/features/settings/widgets/chrome/settings_navigator.dart';
import 'package:kallo_mobile/shared/widgets/panes/detail_pane.dart';
import 'package:kallo_mobile/shared/widgets/form/save_dock.dart';
import 'package:kallo_mobile/shared/widgets/list/list_row.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'pose_harness.dart';
import 'poses.dart';
import 'window_resize_test.dart' show resize;
import 'fixtures.dart';
import 'fixture_api.dart';

void main() {
  setUpAll(initializePoseHarness);

  testWidgets('Circle retains feed offset and reply draft through both folds', (
    tester,
  ) async {
    final f = PoseFixtures();
    final api = fixtureApi(f);
    final handler = api.handler;
    api.handler =
        (request) =>
            Uri.parse(request.path).path == '/api/v1/groups/friends/feed'
                ? {
                  'entries': [
                    for (var i = 0; i < 12; i++)
                      <String, dynamic>{
                        ...f.posts[i % 3],
                        'meal': <String, dynamic>{
                          ...f.posts[i % 3]['meal'] as Map<String, dynamic>,
                          'shareId': 'friend-share-$i',
                        },
                      },
                  ],
                  'nextCursor': null,
                }
                : handler(request);
    final dispose = await bootPose(
      tester,
      poses[5],
      '/circle',
      apiOverride: api,
    );
    expect(find.text('Choose a post to see its replies.'), findsOneWidget);
    expect(find.byType(ThreadComposer), findsNothing);
    final feedScroll = tester.state<ScrollableState>(
      find
          .descendant(
            of: find.byType(CircleScreen),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    feedScroll.position.jumpTo(80);
    await tester.pump();
    final offset = feedScroll.position.pixels;
    final context = tester.element(find.byType(CircleScreen));
    openCircleThread(context, shareId: 'friend-share-0', compose: true);
    await settlePose(tester);
    final thread = tester.state(find.byType(CircleThreadScreen));
    final composer = tester.state(find.byType(ThreadComposer));
    final rect = tester.getRect(find.byType(ReplyPill));
    expect(rect.left, 495.5);
    expect(rect.right, 855);
    expect(find.byIcon(LucideIcons.chevronLeft300), findsNothing);
    await tester.enterText(
      find.byType(EditableText).last,
      'A reply kept through a fold',
    );
    openCircleThread(context, shareId: 'friend-share-0', compose: true);
    await settlePose(tester);
    expect(tester.state(find.byType(ThreadComposer)), same(composer));
    for (final pose in [poses[1], poses[5], poses[1]]) {
      resize(tester, pose);
      await settlePose(tester);
      expect(tester.state(find.byType(CircleThreadScreen)), same(thread));
      expect(tester.state(find.byType(ThreadComposer)), same(composer));
      expect(find.text('A reply kept through a fold'), findsOneWidget);
    }
    GoRouter.of(tester.element(find.byType(CircleThreadScreen))).pop();
    await settlePose(tester);
    expect(feedScroll.mounted, isTrue);
    expect(feedScroll.position.pixels, offset);
    await dispose();
  });

  testWidgets('picking another post swaps the thread beside the feed', (
    tester,
  ) async {
    final dispose = await bootPose(tester, poses[5], '/circle');
    final context = tester.element(find.byType(CircleScreen));
    for (final id in ['friend-share-0', 'friend-share-1', 'friend-share-0']) {
      openCircleThread(context, shareId: id);
      await settlePose(tester);
      expect(
        find.byType(CircleThreadScreen, skipOffstage: false),
        findsOneWidget,
        reason: 'one detail at a time after opening $id',
      );
      expect(
        tester
            .widget<CircleThreadScreen>(find.byType(CircleThreadScreen))
            .shareId,
        id,
      );
    }
    // One step back from any number of picks is the feed with nothing open.
    GoRouter.of(tester.element(find.byType(CircleThreadScreen))).pop();
    await settlePose(tester);
    expect(find.byType(CircleThreadScreen, skipOffstage: false), findsNothing);
    expect(find.text('Choose a post to see its replies.'), findsOneWidget);
    await dispose();
  });

  testWidgets('Settings keeps dirty Body metrics in its nested stack', (
    tester,
  ) async {
    final dispose = await bootPose(tester, poses[5], '/settings');
    final step = tester.state(find.byType(SettingsStepPage));
    final selected = tester
        .widgetList<ListRow>(find.byType(ListRow))
        .where((row) => row.selected);
    expect(selected.single.label, 'Body metrics');
    expect(find.byIcon(LucideIcons.chevronLeft300), findsOneWidget);
    final field = find.byType(EditableText).first;
    await tester.enterText(field, '70');
    await settlePose(tester);
    expect(tester.widget<SaveDock>(find.byType(SaveDock)).visible, isTrue);
    for (final pose in [poses[1], poses[5], poses[1]]) {
      resize(tester, pose);
      await settlePose(tester);
      expect(tester.state(find.byType(SettingsStepPage)), same(step));
      expect(find.text('70'), findsOneWidget);
      expect(tester.widget<SaveDock>(find.byType(SaveDock)).visible, isTrue);
    }
    await dispose();
  });

  testWidgets('wide Settings list remains interactive beside routed details', (
    tester,
  ) async {
    final dispose = await bootPose(tester, poses[5], '/settings');
    final row = find.byWidgetPredicate(
      (w) => w is ListRow && w.label == 'Goal & pace',
    );
    await tester.ensureVisible(row);
    await tester.tap(row);
    await settlePose(tester);
    expect(find.byType(GoalPacePage), findsOneWidget);
    expect(tester.widget<ListRow>(row).selected, isTrue);
    final context = tester.element(find.byType(GoalPacePage));
    pushSettingsPage(context, const AccountDeleteScreen());
    await settlePose(tester);
    expect(
      find.descendant(
        of: find.byType(DetailPane),
        matching: find.byType(AccountDeleteScreen),
      ),
      findsOneWidget,
    );
    expect(tester.getRect(find.byType(AccountDeleteScreen)).left, 495.5);
    await dispose();
  });
}
