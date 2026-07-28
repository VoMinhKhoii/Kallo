import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/logging/data/logging_providers.dart';
import 'package:nham_mobile/features/logging/logic/meal_log_mode.dart';
import 'package:nham_mobile/models/cheat.dart';

/// The composer's cross-surface state must not outlive the account that wrote
/// it.
///
/// `pendingMealProvider` is written by the dashboard's quick-log sheet and read
/// by the logging feed a navigation later, so it cannot be `autoDispose` like
/// every other user-scoped provider. That makes it the one piece of
/// user-content-bearing state that would otherwise survive a sign-out: a meal
/// parked but never claimed — which happens when the router bounces the
/// navigation on an expired session — would be claimed by the NEXT account to
/// open the feed and staged under their token.
///
/// These tests pin the invalidation, not the listener wiring in `app.dart`;
/// they fail if someone makes the providers stateful in a way that survives it.
void main() {
  group('composer state is scoped to the account that wrote it', () {
    test('a parked meal does not survive invalidation', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(pendingMealProvider.notifier).state = 'pho bo, one bowl';
      expect(container.read(pendingMealProvider), 'pho bo, one bowl');

      // What the sessionProvider listener does when the user id changes.
      container.invalidate(pendingMealProvider);

      expect(
        container.read(pendingMealProvider),
        isNull,
        reason: "user A's typed meal must not be readable after they leave",
      );
    });

    test('mode and intensity fall back to their defaults', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(mealLogModeProvider.notifier).state = MealLogMode.cheat;
      container.read(cheatIntensityProvider.notifier).state =
          CheatIntensity.heavy;

      container.invalidate(mealLogModeProvider);
      container.invalidate(cheatIntensityProvider);

      // Otherwise a fresh sign-in silently composes in cheat mode at someone
      // else's intensity, which changes how the estimate is scaled server-side.
      expect(container.read(mealLogModeProvider), MealLogMode.normal);
      expect(container.read(cheatIntensityProvider), CheatIntensity.medium);
    });
  });
}
