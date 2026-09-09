import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/data/stream_analysis_controller.dart';
import 'package:kallo_mobile/features/logging/logic/feed/analysis_run.dart';
import 'package:kallo_mobile/features/logging/logic/relog/slash_token.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/meal_input.dart';
import 'package:kallo_mobile/features/logging/widgets/relog/mention_text_controller.dart';
import 'package:kallo_mobile/models/logging/relog.dart';
import 'package:kallo_mobile/models/logging/streaming.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

/// Captures the submit without answering it.
class _CapturingApi extends ApiClient {
  StreamAnalyzeInput? sent;

  @override
  Stream<StreamEvent> analyzeMeal(StreamAnalyzeInput input) {
    sent = input;
    return const Stream<StreamEvent>.empty();
  }
}

/// Stage a pick into [controller] the way the picker does, over a `/` token
/// the caller has already typed at the end of [text].
void _pick(MentionTextEditingController controller, String text, String name) {
  controller.value = TextEditingValue(
    text: text,
    selection: TextSelection.collapsed(offset: text.length),
  );
  controller.addMention(
    RelogDishCandidate(
      sourceMealId: 'meal-1',
      name: name,
      occurrenceCount: 1,
      lastLoggedAt: '2026-07-01T00:00:00.000Z',
      summary: const RelogMacroSummary(caloriesKcal: 410),
      mealItemOrder: 0,
      ingredientCount: 3,
    ),
    parseSlashToken(text, text.length)!,
    'stage-1',
  );
}

void main() {
  testWidgets('a combined submit is labelled with the sentence as typed', (
    tester,
  ) async {
    final api = _CapturingApi();
    final container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(api)],
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

    // "/Cơm tấm và phở bò" — the pick comes FIRST, which is the case a label
    // rebuilt from `[freeText, ...pickNames]` gets wrong.
    final composer = MentionTextEditingController();
    addTearDown(composer.dispose);
    _pick(composer, '/', 'Cơm tấm');
    composer.setTextAndSync('${composer.text}và phở bò');

    FeedAnalysisRun(
      composer: composer,
      input: MealInputController(),
      onChanged: () {},
      onScrollToAnswer: () {},
    ).startCombined(
      ref,
      userId: 'u1',
      date: '2026-08-10',
      freeText: composer.freeText,
      refs: [for (final entry in composer.entries) entry.ref],
      pickNames: const ['Cơm tấm'],
    );
    await tester.pump();

    final sent = api.sent!;
    expect(
      sent.message,
      'và phở bò',
      reason: 'the AI only ever sees genuinely new food',
    );
    expect(
      sent.displayText,
      'Cơm tấm và phở bò',
      reason: 'the saved meal reads back in the order it was typed',
    );
    expect(sent.toJson()['displayText'], 'Cơm tấm và phở bò');

    container.read(streamAnalysisProvider.notifier).cancel();
    await tester.pump();
  });

  testWidgets('a plain submit sends no label — the message is the sentence', (
    tester,
  ) async {
    final api = _CapturingApi();
    final container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(api)],
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

    final composer = MentionTextEditingController();
    addTearDown(composer.dispose);
    FeedAnalysisRun(
      composer: composer,
      input: MealInputController(),
      onChanged: () {},
      onScrollToAnswer: () {},
    ).startPlain(ref, userId: 'u1', date: '2026-08-10', text: 'phở bò');
    await tester.pump();

    expect(api.sent!.toJson().containsKey('displayText'), isFalse);

    container.read(streamAnalysisProvider.notifier).cancel();
    await tester.pump();
  });
}
