import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/logging_providers.dart';
import 'package:kallo_mobile/features/logging/logic/meal_log_mode.dart';
import 'package:kallo_mobile/models/cheat.dart';

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
/// These drive [resetComposerStateForAccountChange], the same function the
/// `sessionProvider` listener in `app.dart` calls, so they cover the identity
/// rule that decides WHETHER to clear — not merely the invalidation itself.
void main() {
  group('composer state is scoped to the account that wrote it', () {
    test('signing out drops a parked meal', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(pendingMealProvider.notifier).state = 'pho bo, one bowl';

      final cleared = resetComposerStateForAccountChange(
        _Ref(container),
        previousUserId: 'user-a',
        nextUserId: null,
      );

      expect(cleared, isTrue);
      expect(
        container.read(pendingMealProvider),
        isNull,
        reason: "user A's typed meal must not be readable after they leave",
      );
    });

    test('switching accounts resets mode and intensity to their defaults', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(mealLogModeProvider.notifier).state = MealLogMode.cheat;
      container.read(cheatIntensityProvider.notifier).state =
          CheatIntensity.heavy;

      resetComposerStateForAccountChange(
        _Ref(container),
        previousUserId: 'user-a',
        nextUserId: 'user-b',
      );

      // Otherwise a fresh sign-in silently composes in cheat mode at someone
      // else's intensity, which changes how the estimate is scaled server-side.
      expect(container.read(mealLogModeProvider), MealLogMode.normal);
      expect(container.read(cheatIntensityProvider), CheatIntensity.medium);
    });

    test('a token refresh for the SAME account keeps the draft', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(pendingMealProvider.notifier).state = 'half-typed lunch';

      // Supabase re-emits the session on refresh with the same user id. That
      // is not an account change, and discarding someone's half-typed meal
      // because their token rotated would be its own bug.
      final cleared = resetComposerStateForAccountChange(
        _Ref(container),
        previousUserId: 'user-a',
        nextUserId: 'user-a',
      );

      expect(cleared, isFalse);
      expect(container.read(pendingMealProvider), 'half-typed lunch');
    });
  });
}

/// Minimal [WidgetRef] stand-in: the function under test only ever calls
/// `invalidate`, so a container-backed shim keeps this a plain unit test
/// rather than dragging in a widget pump.
class _Ref implements WidgetRef {
  _Ref(this._container);
  final ProviderContainer _container;

  @override
  void invalidate(ProviderOrFamily provider) => _container.invalidate(provider);

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnsupportedError('not needed by these tests');
}
