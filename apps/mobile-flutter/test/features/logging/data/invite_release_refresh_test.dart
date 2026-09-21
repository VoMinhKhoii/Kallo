import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/data/logging_providers.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

// Loading a day sweeps that user's week-abandoned staging cards, and a card
// staged from a friend's cheat offer releases that offer when it goes. So an
// ordinary READ can repopulate the meal-share inbox — and nothing else will say
// so: `mealShareInvitesProvider` is watched continuously by the nav badge, so
// it never auto-disposes and never refetches on its own. Without this refresh
// the handed-back offer is invisible until a pull-to-refresh or a restart,
// which is the reversible "not now" looking like it did nothing.

const _userId = '11111111-1111-1111-1111-111111111111';
const _date = '2026-04-06';

/// Serves a day whose `releasedInvites` the test chooses, and counts how many
/// times the invite inbox was actually fetched.
class _Api extends ApiClient {
  _Api({required this.releasedInvites});

  final bool releasedInvites;
  var inviteFetches = 0;

  @override
  Future<T> get<T>(String path) async {
    if (path.startsWith('/api/v1/groups/invites')) {
      inviteFetches += 1;
      return <String, dynamic>{'invites': <dynamic>[]} as T;
    }
    return <String, dynamic>{
          'persistedMeals': <dynamic>[],
          'pendingConfirmations': <dynamic>[],
          'markedComplete': false,
          'releasedInvites': releasedInvites,
        }
        as T;
  }
}

Future<({int inviteFetches, LoggingDayData day})> loadDay({
  required bool releasedInvites,
}) async {
  final api = _Api(releasedInvites: releasedInvites);
  final container = ProviderContainer(
    overrides: [apiClientProvider.overrideWithValue(api)],
  );
  addTearDown(container.dispose);

  // Something must be listening for the badge's provider to be alive at all —
  // in the app that is the pill nav, which never lets go of it.
  final sub = container.listen(mealShareInvitesProvider, (_, _) {});
  addTearDown(sub.close);
  await container.read(mealShareInvitesProvider.future);

  final day = await container.read(
    loggingDayProvider(const LoggingDayArgs(_userId, _date)).future,
  );
  // Let the deferred invalidation run, then the refetch it triggers.
  await Future<void>.delayed(Duration.zero);
  await container.read(mealShareInvitesProvider.future);

  return (inviteFetches: api.inviteFetches, day: day);
}

void main() {
  test('a day that released an offer refetches the invite inbox', () async {
    final result = await loadDay(releasedInvites: true);

    // Twice: the initial watch, then the refresh the release asked for.
    expect(result.inviteFetches, 2);
  });

  test('an ordinary day load leaves the inbox cache alone', () async {
    // The common case by far — this fires on every day open and every swipe
    // between dates. Refreshing unconditionally would spend a request each time.
    final result = await loadDay(releasedInvites: false);

    expect(result.inviteFetches, 1);
  });

  test('the day itself still arrives intact', () async {
    // The refresh is a side effect of the load, not a replacement for it.
    final result = await loadDay(releasedInvites: true);

    expect(result.day.releasedInvites, isTrue);
    expect(result.day.persistedMeals, isEmpty);
  });

  test('a day response without the field reads as no release', () {
    // The field is additive. A client running against an older server (or a
    // cached response) must read it as "nothing released" — the alternative,
    // defaulting true, refetches the inbox on every single day load forever.
    final day = LoggingDayData.fromJson(const {
      'persistedMeals': <dynamic>[],
      'pendingConfirmations': <dynamic>[],
    });

    expect(day.releasedInvites, isFalse);
  });
}
