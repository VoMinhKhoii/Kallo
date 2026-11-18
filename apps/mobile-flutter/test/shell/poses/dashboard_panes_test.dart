import 'dart:async';
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/features/dashboard/data/dashboard_providers.dart';
import 'package:kallo_mobile/features/dashboard/screens/dashboard_content.dart';
import 'package:kallo_mobile/shared/widgets/feedback/kallo_refresh.dart';
import '../../features/circle/circle_feed_test_support.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/dashboard/widgets/today/day_pager.dart';
import 'package:kallo_mobile/features/dashboard/widgets/states/today_row_skeleton.dart';
import 'package:kallo_mobile/features/dashboard/widgets/today/today_dials.dart';
import 'package:kallo_mobile/shared/widgets/feedback/skeleton.dart';
import 'package:kallo_mobile/shared/widgets/gauge/rounded_gauge_arc.dart';
import 'package:kallo_mobile/features/dashboard/widgets/weight/weight_chart.dart';
import 'package:kallo_mobile/features/dashboard/widgets/chrome/week_strip.dart';
import 'package:kallo_mobile/shared/widgets/brand/kallo_wordmark.dart';
import 'package:kallo_mobile/shell/header/profile_avatar_button.dart';
import 'harness/pose_harness.dart';
import 'harness/poses.dart';

const _outerLandscapeLeft = Pose(
  'outer-landscape-left',
  Size(678, 466),
  EdgeInsets.only(left: 84, bottom: 34),
);

List<Rect> _todayArcs(WidgetTester tester) =>
    tester
        .widgetList(
          find.descendant(
            of: find.byType(TodayDials),
            matching: find.byType(RoundedGaugeArc),
          ),
        )
        .map((arc) => tester.getRect(find.byWidget(arc)))
        .toList();

void main() {
  setUpAll(initializePoseHarness);
  // On a short, wide window the stacked dials ran off the bottom edge and cut
  // the macros in half (iPhone Duo's closed display turned, 2026-11-18).
  for (final pose in [outerLandscape, _outerLandscapeLeft, phoneLandscape]) {
    testWidgets('Today shows all four dials in one row at ${pose.name}', (
      tester,
    ) async {
      final dispose = await bootPose(tester, pose, '/dashboard');
      final arcs = _todayArcs(tester);
      expect(arcs, hasLength(4));
      final gaps = [
        for (var i = 1; i < 4; i++) arcs[i].left - arcs[i - 1].right,
      ];
      for (final gap in gaps) {
        expect(gap, greaterThan(0));
        expect(gap, closeTo(gaps.first, 1), reason: '$gaps');
      }
      final row = tester.getRect(find.byType(TodayDials));
      expect(
        arcs.first.left - row.left,
        closeTo(row.right - arcs.last.right, 1),
      );
      final lowest = tester
          .widgetList(
            find.descendant(
              of: find.byType(TodayDials),
              matching: find.byType(RichText),
            ),
          )
          .map((text) => tester.getRect(find.byWidget(text)).bottom)
          .reduce((a, b) => a > b ? a : b);
      expect(lowest, lessThanOrEqualTo(pose.size.height - pose.padding.bottom));
      expect(tester.takeException(), isNull);
      await dispose();
    });
  }
  testWidgets('Today loads in the row shape it lands in at outer-landscape', (
    tester,
  ) async {
    final dispose = await bootPose(tester, outerLandscape, '/dashboard');
    final context = tester.element(find.byType(DashboardContent));
    final api =
        ProviderScope.containerOf(context).read(apiClientProvider)
            as FakeApiClient;
    final handler = api.handler;
    final pending = Completer<void>();
    api.handler = (request) async {
      if (Uri.parse(request.path).path == '/api/v1/logging/day') {
        await pending.future;
      }
      return handler(request);
    };
    // Yesterday is not cached, so its page loads while the day is held.
    final pager = tester.widget<DayPager>(find.byType(DayPager));
    pager.controller.jumpToPage(pager.controller.page!.round() - 1);
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    final placeholder = tester.getRect(
      find
          .descendant(
            of: find.byType(TodayRowSkeleton),
            matching: find.byType(SkeletonBar),
          )
          .first,
    );
    pending.complete();
    await settlePose(tester);
    expect(find.byType(TodayRowSkeleton), findsNothing);
    final arc = _todayArcs(tester).first;
    expect(placeholder.left, closeTo(arc.left, .5));
    expect(placeholder.top, closeTo(arc.top, .5));
    expect(placeholder.size, arc.size);
    expect(tester.takeException(), isNull);
    await dispose();
  });
  testWidgets('Today keeps its dials, not a fresh sweep, across a rotation', (
    tester,
  ) async {
    final dispose = await bootPose(tester, outerPortrait, '/dashboard');
    List<State> arcStates() =>
        tester
            .stateList(
              find.descendant(
                of: find.byType(TodayDials),
                matching: find.byType(RoundedGaugeArc),
              ),
            )
            .toList();
    final stacked = _todayArcs(tester);
    // Stacked: the calorie dial sits above the macro row.
    expect(stacked.first.bottom, lessThanOrEqualTo(stacked[1].top));
    final before = arcStates();
    resize(tester, outerLandscape);
    await settlePose(tester);
    final row = _todayArcs(tester);
    expect(row[1].left, greaterThan(row.first.right));
    final after = arcStates();
    for (var i = 0; i < 4; i++) {
      expect(after[i], same(before[i]), reason: 'dial $i');
    }
    resize(tester, outerPortrait);
    await settlePose(tester);
    expect(arcStates().first, same(before.first));
    expect(tester.takeException(), isNull);
    await dispose();
  });
  testWidgets('Today mirrors the pane geometry beside a left control column', (
    tester,
  ) async {
    final dispose = await bootPose(
      tester,
      const Pose(
        'left-column',
        Size(951, 669),
        EdgeInsets.only(left: 84, bottom: 34),
      ),
      '/dashboard',
    );
    final day = tester.getRect(find.byType(DayPager));
    final weight = tester.getRect(find.byType(WeightChart));
    expect(day.left, 495.5);
    expect(day.right, 939);
    expect(weight.left, 96);
    expect(weight.right, 455.5);
    expect(tester.getRect(find.byType(KalloWordmark)).right, 939);
    expect(tester.getRect(find.byType(ProfileAvatarButton)).left, 96);
    expect(tester.takeException(), isNull);
    await dispose();
  });
  testWidgets(
    'Today panes keep yesterday across folding and have an empty gutter',
    (tester) async {
      final dispose = await bootPose(tester, innerLandscape, '/dashboard');
      final day = tester.getRect(find.byType(DayPager));
      final weight = tester.getRect(find.byType(WeightChart));
      expect(day.left, 12);
      expect(day.right, 455.5);
      expect(weight.left, 495.5);
      expect(weight.right, 855);
      // 28 above the header row (the inner display's corner), then its 48.
      expect(tester.getRect(find.byType(WeekStrip)).top, 76);
      expect(tester.getRect(find.byType(KalloRefreshableScroll).last).top, 76);
      expect(tester.getRect(find.byType(KalloWordmark)).left, 12);
      expect(tester.getRect(find.byType(ProfileAvatarButton)).right, 855);
      final pager = tester.widget<DayPager>(find.byType(DayPager));
      pager.controller.jumpToPage(pager.controller.page!.round() - 1);
      await settlePose(tester);
      final page = pager.controller.page;
      final state = tester.state(find.byType(DayPager));
      resize(tester, outerPortrait);
      await settlePose(tester);
      expect(tester.state(find.byType(DayPager)), same(state));
      expect(
        tester.widget<DayPager>(find.byType(DayPager)).controller.page,
        page,
      );
      expect(find.text('Yesterday'), findsWidgets);
      resize(tester, innerPortrait);
      await settlePose(tester);
      expect(tester.getRect(find.byType(DayPager)).left, 54.5);
      expect(tester.getRect(find.byType(DayPager)).right, 614.5);
      resize(tester, phoneLandscape);
      await settlePose(tester);
      expect(tester.getRect(find.byType(DayPager)).left, 157);
      expect(tester.getRect(find.byType(DayPager)).width, 560);
      expect(find.byType(WeekStrip), findsOneWidget);
      expect(tester.takeException(), isNull);
      await dispose();
    },
  );
  testWidgets('near pull refreshes the bundle with only its own held inset', (
    tester,
  ) async {
    final dispose = await bootPose(tester, innerLandscape, '/dashboard');
    final context = tester.element(find.byType(DashboardContent));
    final container = ProviderScope.containerOf(context);
    final api = container.read(apiClientProvider) as FakeApiClient;
    final handler = api.handler;
    final pending = Completer<Object?>();
    FutureOr<Object?>? response;
    api.handler = (request) {
      if (Uri.parse(request.path).path == '/api/v1/dashboard') {
        response = handler(request);
        return pending.future;
      }
      return handler(request);
    };
    final args =
        tester.widget<DashboardContent>(find.byType(DashboardContent)).args;
    final before = container.read(dashboardBundleProvider(args)).value;
    await tester.dragFrom(const Offset(700, 120), const Offset(0, 350));
    for (var i = 0; i < 20; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    expect(response, isNotNull);
    for (final element in find.byType(KalloRefreshableScroll).evaluate()) {
      final scroll = find.byElementPredicate((e) => e == element);
      final x = tester.getRect(scroll).left;
      final refresh = find.descendant(
        of: scroll,
        matching: find.byType(KalloRefresh, skipOffstage: false),
        skipOffstage: false,
      );
      expect(
        tester.renderObject<RenderSliver>(refresh).geometry!.layoutExtent,
        x > 475 ? greaterThan(0) : 0,
        reason: 'refresh at x=$x',
      );
    }
    pending.complete(await response);
    await settlePose(tester);
    final after = container.read(dashboardBundleProvider(args)).value;
    expect(after, isNot(same(before)));
    expect(
      container.read(weightSummaryProvider(args)).value,
      same(after!.weightSummary),
    );
    expect(container.read(heatmapProvider(args)).value, same(after.heatmap));
    expect(find.byType(DayPager), findsOneWidget);
    await dispose();
  });
  testWidgets(
    'Today restores far offset and reveals Progress after a near drag',
    (tester) async {
      final dispose = await bootPose(tester, innerLandscape, '/dashboard');
      ScrollPosition far() =>
          tester
              .state<ScrollableState>(
                find
                    .descendant(
                      of: find.byType(KalloRefreshableScroll).first,
                      matching: find.byType(Scrollable),
                    )
                    .first,
              )
              .position;
      far().jumpTo(80);
      await tester.pumpAndSettle();
      resize(tester, outerPortrait);
      await settlePose(tester);
      expect(far().pixels, 80);
      resize(tester, innerLandscape);
      await settlePose(tester);
      expect(far().pixels, 80);
      await tester.dragFrom(const Offset(700, 120), const Offset(0, -100));
      await tester.pumpAndSettle();
      resize(tester, outerPortrait);
      await settlePose(tester);
      // Progress comes up under the header row, or as far up as the content
      // below it allows: on the outer display the two cards are shorter than
      // the viewport, so the scroll stops at its end with Progress on screen.
      final progressTop = tester.getTopLeft(find.text('Progress')).dy;
      expect(
        (progressTop - 61).abs() < 0.01 ||
            far().pixels == far().maxScrollExtent,
        isTrue,
        reason: 'Progress at $progressTop, offset ${far().pixels}',
      );
      expect(progressTop, lessThan(outerPortrait.size.height / 2));
      await dispose();
    },
  );
}
