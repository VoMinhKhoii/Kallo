import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/data/logging_ui_state.dart';
import 'package:kallo_mobile/features/logging/logic/relog/mentions.dart';

/// The Log screen is a full-screen push (native pass): its widget tree dies on
/// every pop. State a user would call "mine" — the composer draft, which cards
/// they opened — must therefore live in the app-lifetime container, not the
/// route (TestFlight regression, 2026-08-31). It must live there as DATA: the
/// controller it used to hold was disposed under the mounted composer on an
/// account switch (see feed/feed_area_draft_test.dart).
void main() {
  test('the composer draft starts empty and holds plain data', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final draft = container.read(composerDraftProvider);
    expect(draft, isA<MentionSnapshot>());
    expect(draft.text, isEmpty);
    expect(draft.mentions, isEmpty);
  });

  test('expanded-card ids persist in the container', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    container.read(expandedMealCardsProvider.notifier).state = {'m1'};
    expect(container.read(expandedMealCardsProvider), contains('m1'));
  });

  test('an account switch resets the draft and the expansion set', () {
    // Sticky state outliving the ROUTE is the fix; outliving the ACCOUNT on a
    // shared device would be a leak (CodeRabbit, PR #329).
    final owner = StateProvider<String?>((ref) => 'user-a');
    final container = ProviderContainer(
      overrides: [
        loggingUiOwnerProvider.overrideWith((ref) => ref.watch(owner)),
      ],
    );
    addTearDown(container.dispose);

    container.read(composerDraftProvider.notifier).state = const MentionSnapshot(
      text: 'gà nướng',
      mentions: [],
    );
    container.read(expandedMealCardsProvider.notifier).state = {'m1'};

    container.read(owner.notifier).state = 'user-b';

    expect(container.read(composerDraftProvider).text, isEmpty);
    expect(container.read(expandedMealCardsProvider), isEmpty);
  });
}
