import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/data/stream_analysis_controller.dart';
import 'package:kallo_mobile/features/logging/logic/feed/analysis/analysis_run.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/meal_input.dart';
import 'package:kallo_mobile/features/logging/widgets/relog/mention_text_controller.dart';
import 'package:kallo_mobile/models/logging/streaming.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/models/http/stream_analyze_input.dart';

/// An analysis that goes out and never answers on its own, so the test decides
/// when — and on which day — the answer lands.
class _HangingApi extends ApiClient {
  final StreamController<StreamEvent> _events =
      StreamController<StreamEvent>.broadcast();

  @override
  Stream<StreamEvent> analyzeMeal(StreamAnalyzeInput input) => _events.stream;
}

void main() {
  testWidgets('an answer outlives the day it was sent on', (tester) async {
    // `FeedArea` is not keyed by date: paging to another day changes the target
    // under a [FeedAnalysisRun] that stays. An analysis is slow enough to
    // outlive that, and the completion used whatever day was on screen when it
    // landed rather than the day it was sent on.
    final container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(_HangingApi())],
    );
    addTearDown(container.dispose);

    late WidgetRef ref;
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: Consumer(
          builder: (_, r, _) {
            ref = r;
            return const SizedBox();
          },
        ),
      ),
    );

    // The answer's only feedback is a haptic — it does not scroll the feed,
    // which by then holds a turn the user is reading. The send's own ride to
    // the top is counted separately.
    var buzzed = 0;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'HapticFeedback.vibrate') buzzed++;
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );

    var pinned = 0;
    final composer = MentionTextEditingController();
    addTearDown(composer.dispose);
    final run = FeedAnalysisRun(
      composer: composer,
      input: MealInputController(),
      onChanged: () {},
      onScrollToAnswer: () => pinned++,
    );

    // Sent on Monday, answered while Monday is still on screen.
    run.startPlain(ref, userId: 'u1', date: '2026-08-10', text: 'phở bò');
    expect(pinned, 1, reason: 'the SEND carries its turn to the top');
    pinned = 0;
    buzzed = 0;
    run.reveal(ref, userId: 'u1', date: '2026-08-10');
    await tester.pump();
    expect(buzzed, 1, reason: 'the answer for the day on screen belongs on it');
    expect(
      pinned,
      0,
      reason: 'and it lands in the room the send left, without scrolling',
    );

    // Sent on Monday, answered after the user paged to Tuesday. The card is
    // pinned to `stream.loggedDate` by [FeedViewState], so Tuesday's feed has
    // nothing new on it — buzzing for it is an answer delivered to the wrong
    // screen.
    run.startPlain(ref, userId: 'u1', date: '2026-08-10', text: 'bún chả');
    buzzed = 0;
    run.reveal(ref, userId: 'u1', date: '2026-08-11');
    await tester.pump();
    expect(
      buzzed,
      0,
      reason: "Monday's answer must not buzz for Tuesday's feed",
    );

    // The reveal is kept, not thrown away — paging back to Monday still finds
    // the answer waiting to be confirmed.
    expect(run.revealRawInput, 'bún chả');

    container.read(streamAnalysisProvider.notifier).cancel();
    await tester.pump();
  });
}
