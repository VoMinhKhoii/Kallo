import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/data/invite_mutations.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import 'circle_feed_test_support.dart';

/// The two ways a meal-share offer resolves into a meal differ in kind, not
/// just in endpoint: accepting LOGS the sender's meal, while taking a cheat
/// offer logs nothing and hands back a day to navigate to.
void main() {
  late FakeApiClient api;
  late ProviderContainer container;
  late ContainerWidgetRef ref;

  setUp(() {
    api = FakeApiClient((_) async => <String, dynamic>{});
    container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(api)],
    );
    ref = ContainerWidgetRef(container);
  });

  tearDown(() => container.dispose());

  test(
    'taking a cheat offer posts to accept-cheat and returns its day',
    () async {
      api.handler =
          (_) async => <String, dynamic>{
            'analysisId': 'a1',
            'rawInput': 'Buffet nướng',
            'loggedAt': '2026-04-05T00:30:00.000Z',
            'spec': <String, dynamic>{},
          };

      final loggedAt = await stageCheatMealShareInvite(ref, 'inv-1');

      expect(api.requests.single.path, '/api/v1/groups/invites/accept-cheat');
      expect(api.requests.single.body, {'inviteId': 'inv-1'});
      // The caller navigates with this: the staged card is stamped at the SOURCE
      // meal's instant, so landing on today would show an empty feed and a card
      // the recipient cannot find.
      expect(loggedAt, '2026-04-05T00:30:00.000Z');
    },
  );

  test('a server that omits loggedAt degrades to empty, not a crash', () async {
    api.handler = (_) async => <String, dynamic>{'analysisId': 'a1'};

    // goToLoggingDay falls back to today on an unparseable value. Landing on
    // the wrong day costs one tap; throwing here would strand an invite that
    // the server has already consumed.
    expect(await stageCheatMealShareInvite(ref, 'inv-1'), '');
  });

  test(
    'accepting a precise offer still logs through the accept endpoint',
    () async {
      await acceptMealShareInvite(ref, 'inv-2');

      expect(api.requests.single.path, '/api/v1/groups/invites/accept');
      final body = api.requests.single.body as Map<String, dynamic>;
      expect(body['inviteId'], 'inv-2');
      // Still sent for wire compatibility with older servers; the current one
      // ignores it and stamps the copy at the source meal's instant.
      expect(body.containsKey('loggedDate'), isTrue);
    },
  );
}
