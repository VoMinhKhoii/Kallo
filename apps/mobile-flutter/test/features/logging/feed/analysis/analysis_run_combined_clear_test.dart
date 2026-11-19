import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/data/stream_analysis_controller.dart';
import 'package:kallo_mobile/features/logging/logic/feed/analysis/analysis_run.dart';
import 'package:kallo_mobile/features/logging/logic/relog/composer_submit.dart';
import 'package:kallo_mobile/features/logging/logic/relog/slash_token.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/meal_input.dart';
import 'package:kallo_mobile/features/logging/widgets/relog/mention_text_controller.dart';
import 'package:kallo_mobile/features/privacy/data/ai_consent_providers.dart';
import 'package:kallo_mobile/models/http/stream_analyze_input.dart';
import 'package:kallo_mobile/models/logging/relog.dart';
import 'package:kallo_mobile/models/logging/streaming.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../l10n_test_loader.dart';

/// Holds the analysis open, so the composer is judged while it is in flight.
class _OpenApi extends ApiClient {
  StreamAnalyzeInput? sent;
  final _events = StreamController<StreamEvent>();

  @override
  Stream<StreamEvent> analyzeMeal(StreamAnalyzeInput input) {
    sent = input;
    return _events.stream;
  }
}

void main() {
  setUpTranslations();

  testWidgets('sending free text with a pick empties the field at once', (
    tester,
  ) async {
    final api = _OpenApi();
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        aiConsentProvider.overrideWithValue(true),
      ],
    );
    addTearDown(container.dispose);
    final composer = MentionTextEditingController();
    addTearDown(composer.dispose);
    final input = MealInputController();
    final submitter = ComposerSubmitter(
      composer: composer,
      run: FeedAnalysisRun(
        composer: composer,
        input: input,
        onChanged: () {},
        onScrollToAnswer: () {},
      ),
      onChanged: () {},
      onStaged: () {},
    );

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Scaffold(
            body: Consumer(
              builder:
                  (context, ref, _) => MealInput(
                    controller: input,
                    textController: composer,
                    onSubmit:
                        (text) => submitter.submit(
                          context,
                          ref,
                          userId: 'u1',
                          date: '2026-11-09',
                          text: text,
                        ),
                  ),
            ),
          ),
        ),
      ),
    );

    await tester.showKeyboard(find.byType(TextField));
    composer.value = const TextEditingValue(
      text: '/',
      selection: TextSelection.collapsed(offset: 1),
    );
    composer.addMention(
      const RelogDishCandidate(
        sourceMealId: 'meal-1',
        name: 'Cafe sữa tươi',
        occurrenceCount: 1,
        lastLoggedAt: '2026-07-01T00:00:00.000Z',
        summary: RelogMacroSummary(caloriesKcal: 73),
        mealItemOrder: 0,
        ingredientCount: 2,
      ),
      parseSlashToken('/', 1)!,
      'stage-1',
    );
    composer.setTextAndSync('${composer.text}cơm chiên cá hồi');
    await tester.pump();

    await tester.tap(find.byIcon(LucideIcons.arrowUp400));
    await tester.pump();

    expect(api.sent?.message, 'cơm chiên cá hồi');
    expect(api.sent?.refs, hasLength(1));
    expect(composer.text, isEmpty);
    expect(composer.entries, isEmpty);

    container.read(streamAnalysisProvider.notifier).cancel();
    await tester.pump();
  });
}
