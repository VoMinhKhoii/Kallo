import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/data/chat_group_providers.dart';
import 'package:kallo_mobile/models/http/api_error.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/services/http/query_cache.dart';
import '../circle_feed_test_support.dart';

Map<String, dynamic> _detail(String name) => {
  'group': {
    'id': 'g',
    'kind': 'group',
    'name': name,
    'myRole': 'member',
    'members': [
      {'userId': 'me', 'handle': 'me', 'role': 'member'},
    ],
  },
};

void main() {
  test(
    'rapid return to a loading group reuses the pending detail request',
    () async {
      final gate = Completer<Object?>();
      var calls = 0;
      final container = makeContainer(
        FakeApiClient((_) {
          calls++;
          return gate.future;
        }),
      );
      final provider = chatGroupDetailProvider('g');
      final first = container.listen(provider, (_, __) {});
      first.close();
      await container.pump();
      final returned = container.listen(provider, (_, __) {});
      expect(calls, 1);
      gate.complete(_detail('Lunch'));
      expect((await container.read(provider.future)).name, 'Lunch');
      returned.close();
    },
  );

  testWidgets(
    'group faces are cached; stale details stay visible while refreshing',
    (tester) async {
      var calls = 0;
      var now = DateTime.utc(2026, 11, 10);
      final gate = Completer<Object?>();
      final api = FakeApiClient(
        (_) => ++calls == 1 ? _detail('Old name') : gate.future,
      );
      final container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          signedInUserIdProvider.overrideWithValue('me'),
          queryNowProvider.overrideWithValue(() => now),
        ],
      );
      final provider = chatGroupDetailProvider('g');
      final first = container.listen(provider, (_, __) {});
      await tester.pump();
      first.close();
      await tester.pump(const Duration(milliseconds: 1));
      final second = container.listen(provider, (_, __) {});
      await tester.pump();
      expect(calls, 1);
      expect(container.read(provider).valueOrNull?.members.single.userId, 'me');
      second.close();
      await tester.pump(const Duration(milliseconds: 1));
      now = now.add(const Duration(minutes: 1, seconds: 1));
      container.listen(provider, (_, __) {});
      await tester.pump(const Duration(milliseconds: 1));
      expect(calls, 2);
      expect(container.read(provider).valueOrNull?.name, 'Old name');
      gate.complete(_detail('New name'));
      await tester.pump();
      expect(container.read(provider).requireValue.name, 'New name');
      container.dispose();
      await tester.pump(const Duration(milliseconds: 1));
    },
  );

  test(
    'detail caches rebuild across accounts and make no signed-out request',
    () async {
      final account = StateProvider<String?>((ref) => 'a');
      var calls = 0;
      final api = FakeApiClient((_) => _detail('request-${++calls}'));
      final container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          signedInUserIdProvider.overrideWith((ref) => ref.watch(account)),
        ],
      );
      addTearDown(container.dispose);
      final provider = chatGroupDetailProvider('g');
      final first = container.listen(provider, (_, __) {});
      await container.read(provider.future);
      first.close();
      await container.pump();
      container.read(account.notifier).state = null;
      await expectLater(
        container.read(provider.future),
        throwsA(isA<ApiError>()),
      );
      expect(calls, 1);
      container.read(account.notifier).state = 'b';
      holdProvider(container, provider);
      expect((await container.read(provider.future)).name, 'request-2');
      container.invalidate(provider);
      expect((await container.read(provider.future)).name, 'request-3');
    },
  );
}
