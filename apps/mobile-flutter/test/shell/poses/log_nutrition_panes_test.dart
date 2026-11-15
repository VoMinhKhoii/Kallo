import 'package:flutter/material.dart';
import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kallo_mobile/models/http/stream_analyze_input.dart';
import 'package:kallo_mobile/models/logging/streaming.dart';
import 'package:kallo_mobile/features/logging/data/stream_analysis_controller.dart';
import 'package:kallo_mobile/features/logging/widgets/streaming/streaming_entry.dart';
import '../../features/circle/circle_feed_test_support.dart';
import 'harness/fixture_api.dart';
import 'harness/fixtures.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/feed_area.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/feed_list.dart';
import 'package:kallo_mobile/features/logging/widgets/timeline/timeline_picker.dart';
import 'package:kallo_mobile/features/logging/widgets/timeline/timeline_strip.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/meal_input.dart';
import 'package:kallo_mobile/features/nutrition/widgets/summary/day_summary.dart';
import 'package:kallo_mobile/features/nutrition/widgets/scope/range_selector.dart';
import 'package:kallo_mobile/shared/widgets/feedback/kallo_refresh.dart';
import 'harness/pose_harness.dart';
import 'harness/poses.dart';

void main() {
  setUpAll(initializePoseHarness);
  testWidgets(
    'Log keeps one analysis request alive through a mid-stream fold',
    (tester) async {
      final api = _StreamingApi();
      final dispose = await bootPose(
        tester,
        innerLandscape,
        '/logging',
        apiOverride: api,
      );
      final scope = ProviderScope.containerOf(
        tester.element(find.byType(FeedArea)),
      );
      final date = tester.widget<FeedArea>(find.byType(FeedArea)).date;
      unawaited(
        scope
            .read(streamAnalysisProvider.notifier)
            .analyze(
              StreamAnalyzeInput(
                message: '2 eggs and toast',
                loggedDate: date,
                timezoneOffset: 0,
              ),
            ),
      );
      await tester.pump();
      api.events.add(const StageEvent(stage: PipelineStage.decomposing));
      await tester.pump();
      final scroll =
          tester.widget<FeedList>(find.byType(FeedList)).scrollController;
      scroll.jumpTo(scroll.position.maxScrollExtent);
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byType(StreamingEntry), findsOneWidget);
      final element = find.byType(StreamingEntry).evaluate().single;
      for (final pose in [outerPortrait, innerLandscape]) {
        resize(tester, pose);
        await tester.pump(const Duration(milliseconds: 100));
        expect(find.byType(StreamingEntry).evaluate().single, same(element));
        expect(scope.read(streamAnalysisProvider).isAnalyzing, isTrue);
        expect(api.calls, 1);
        expect(tester.takeException(), isNull);
      }
      scope.read(streamAnalysisProvider.notifier).cancel();
      unawaited(api.events.close());
      await tester.pump();
      await dispose();
    },
  );

  testWidgets('Log closes an open date picker when it unfolds', (tester) async {
    final dispose = await bootPose(tester, outerPortrait, '/logging');
    tester.widget<DateMorph>(find.byType(DateMorph)).onExpand();
    await tester.pumpAndSettle();
    expect(tester.widget<DateMorph>(find.byType(DateMorph)).expanded, isTrue);
    resize(tester, innerLandscape);
    await settlePose(tester);
    resize(tester, outerPortrait);
    await settlePose(tester);
    expect(tester.widget<DateMorph>(find.byType(DateMorph)).expanded, isFalse);
    expect(tester.takeException(), isNull);
    await dispose();
  });

  testWidgets('Log moves the live composer and selected day across the fold', (
    tester,
  ) async {
    final api = _StreamingApi();
    final dispose = await bootPose(
      tester,
      innerLandscape,
      '/logging',
      apiOverride: api,
    );
    final owner = tester.state(find.byType(FeedArea));
    final strip = tester.widget<TimelineStrip>(find.byType(TimelineStrip));
    final yesterday = DateTime.parse(
      strip.today,
    ).subtract(const Duration(days: 1)).toIso8601String().substring(0, 10);
    strip.onSelectDate(yesterday);
    await settlePose(tester);
    final field = find.byType(EditableText).last;
    await tester.enterText(field, '2 eggs and toast');
    final editing = tester.widget<EditableText>(field);
    editing.controller.selection = const TextSelection.collapsed(offset: 6);
    expect(editing.focusNode.hasFocus, isTrue);
    final input = tester.getRect(find.byType(MealInput));
    expect(input.left, 495.5);
    expect(input.right, 855);
    expect(input.bottom, 623);
    expect(tester.getRect(find.byType(TimelineStrip)).top, 60);
    tester.view.viewInsets = const FakeViewPadding(bottom: 440);
    tester.view.padding = const FakeViewPadding(right: 168);
    await tester.pump();
    expect(tester.getRect(find.byType(MealInput)).bottom, 437);
    tester.view.viewInsets = const FakeViewPadding();
    for (final pose in [outerPortrait, innerLandscape, pipPinned]) {
      resize(tester, pose);
      await settlePose(tester);
      expect(tester.state(find.byType(FeedArea)), same(owner));
      final current = tester.widget<EditableText>(field);
      expect(current.controller, same(editing.controller));
      expect(current.controller.text, '2 eggs and toast');
      expect(current.controller.selection.baseOffset, 6);
      expect(current.focusNode, same(editing.focusNode));
      expect(current.focusNode.hasFocus, isTrue);
      expect(tester.widget<FeedArea>(find.byType(FeedArea)).date, yesterday);
      if (pose != outerPortrait) {
        final rect = tester.getRect(find.byType(MealInput));
        expect(rect.left, 495.5);
        expect(rect.right, 855);
      }
      expect(tester.takeException(), isNull);
      expect(api.calls, 0);
    }
    await dispose();
  });

  testWidgets('Nutrition restores both nonzero offsets after a fold', (
    tester,
  ) async {
    final dispose = await bootPose(tester, pipPinned, '/nutrition');
    final (far, near) = _paneScrolls(tester);
    expect(far.position.maxScrollExtent, greaterThan(0));
    expect(near.position.maxScrollExtent, greaterThan(0));
    far.jumpTo(far.position.maxScrollExtent / 2);
    near.jumpTo(near.position.maxScrollExtent / 2);
    await settlePose(tester);
    final offsets = (far.offset, near.offset);
    resize(tester, outerPortrait);
    await settlePose(tester);
    resize(tester, pipPinned);
    await settlePose(tester);
    // The near pane was unmounted in one column, so read the panes again.
    final (farAfter, nearAfter) = _paneScrolls(tester);
    expect(farAfter.offset, offsets.$1);
    expect(nearAfter.offset, offsets.$2);
    await dispose();
  });

  testWidgets(
    'Nutrition aligns sections and preserves chart selection and pane offsets',
    (tester) async {
      final dispose = await bootPose(tester, innerLandscape, '/nutrition');
      expect(tester.getRect(find.byType(NutritionRangeSelector)).right, 855);
      expect(
        tester.getRect(find.text('Vitamins')).top,
        tester.getRect(find.text('Calories').first).top,
      );
      final summary = tester.widget<DaySummary>(find.byType(DaySummary));
      final thursday = summary.daySeries.series.first.buckets.indexWhere(
        (b) => DateTime.parse(b.startDate).weekday == DateTime.thursday,
      );
      summary.onSelect(thursday);
      await settlePose(tester);
      final (far, near) = _paneScrolls(tester);
      far.jumpTo(40);
      near.jumpTo(60);
      await settlePose(tester);
      final farOffset = far.offset;
      final nearOffset = near.offset;
      for (final pose in [outerPortrait, innerLandscape, pipPinned]) {
        resize(tester, pose);
        await settlePose(tester);
        expect(
          tester.widget<DaySummary>(find.byType(DaySummary)).selectedIndex,
          thursday,
        );
        if (pose != outerPortrait) {
          final (far, near) = _paneScrolls(tester);
          expect(far.offset, farOffset);
          expect(near.offset, nearOffset);
        }
        expect(tester.takeException(), isNull);
      }
      await dispose();
    },
  );
}

/// The far and near panes' scroll controllers, as mounted now. Each pane owns
/// its controller, so a pane that a one-column window unmounts comes back
/// with a new one; its offset is what must survive.
(ScrollController, ScrollController) _paneScrolls(WidgetTester tester) {
  final scrolls =
      tester
          .widgetList<KalloRefreshableScroll>(
            find.byType(KalloRefreshableScroll),
          )
          .toList();
  return (scrolls.first.controller!, scrolls.last.controller!);
}

class _StreamingApi extends FakeApiClient {
  _StreamingApi() : super(fixtureApi(PoseFixtures()).handler);
  final events = StreamController<StreamEvent>();
  int calls = 0;
  @override
  Stream<StreamEvent> analyzeMeal(StreamAnalyzeInput input) {
    calls++;
    return events.stream;
  }
}
