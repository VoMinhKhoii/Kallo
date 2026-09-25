import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/circle/data/moderation_mutations.dart';
import 'package:kallo_mobile/models/http/api_error.dart';
import 'package:kallo_mobile/models/social/moderation.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import 'circle_feed_test_support.dart';

const _userId = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const _targetId = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

/// The wire contract of block / unblock / report, and the caches a block has
/// to refresh — a block hides content from many surfaces at once, so leaving
/// one cache warm would keep showing the blocked person there.
void main() {
  late FakeApiClient api;
  late ProviderContainer container;
  late ContainerWidgetRef ref;

  setUp(() {
    api = FakeApiClient((request) async {
      if (request.path == '/api/v1/groups/friends') {
        return <String, dynamic>{'circle': <dynamic>[]};
      }
      if (request.path == '/api/v1/groups/friends/blocked') {
        return <String, dynamic>{'blocked': <dynamic>[]};
      }
      return <String, dynamic>{};
    });
    container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(api)],
    );
    ref = ContainerWidgetRef(container);
  });

  tearDown(() => container.dispose());

  int fetches(String path) =>
      api.requests.where((r) => r.method == 'GET' && r.path == path).length;

  test(
    'blocking posts the target and refetches friends and the blocked list',
    () async {
      final friends = container.listen(circleFriendsProvider, (_, _) {});
      final blocked = container.listen(blockedCircleUsersProvider, (_, _) {});
      await container.read(circleFriendsProvider.future);
      await container.read(blockedCircleUsersProvider.future);

      await blockCircleUser(ref, _userId);

      final post = api.requests.firstWhere((r) => r.method == 'POST');
      expect(post.path, '/api/v1/groups/friends/block');
      expect(post.body, {'targetUserId': _userId});

      await container.read(circleFriendsProvider.future);
      await container.read(blockedCircleUsersProvider.future);
      expect(fetches('/api/v1/groups/friends'), 2);
      expect(fetches('/api/v1/groups/friends/blocked'), 2);
      friends.close();
      blocked.close();
    },
  );

  test('unblocking posts to the unblock endpoint', () async {
    await unblockCircleUser(ref, _userId);

    expect(api.requests.single.method, 'POST');
    expect(api.requests.single.path, '/api/v1/groups/friends/unblock');
    expect(api.requests.single.body, {'targetUserId': _userId});
  });

  test('a 404 unblock (not your block) surfaces as ApiError', () async {
    api.handler = (_) async => throw ApiError('NOT_FOUND', 404, false, 'nope');

    await expectLater(
      unblockCircleUser(ref, _userId),
      throwsA(isA<ApiError>().having((e) => e.status, 'status', 404)),
    );
  });

  test('the blocked list parses profiles and block times', () async {
    api.handler =
        (_) async => <String, dynamic>{
          'blocked': [
            {
              'profile': {
                'userId': _userId,
                'handle': 'phofan',
                'displayName': 'Phở Fan',
                'avatarSeed': null,
                'avatarUrl': null,
                'hasCustomAvatar': false,
              },
              'blockedAt': '2026-09-20T08:00:00.000Z',
            },
          ],
        };

    final list = await container.read(blockedCircleUsersProvider.future);

    expect(list, hasLength(1));
    expect(list.single.profile.label, 'Phở Fan');
    expect(list.single.blockedAt, DateTime.utc(2026, 9, 20, 8));
  });

  test(
    'reporting sends wire values, trims the note and returns the id',
    () async {
      api.handler = (_) async => <String, dynamic>{'id': 'report-1'};

      final id = await reportCircleContent(
        ref,
        kind: ReportTargetKind.chatMessage,
        targetId: _targetId,
        targetUserId: _userId,
        reason: ReportReason.selfHarm,
        note: '  worrying  ',
      );

      expect(id, 'report-1');
      expect(api.requests.single.path, '/api/v1/reports');
      expect(api.requests.single.body, {
        'targetKind': 'chat_message',
        'targetId': _targetId,
        'targetUserId': _userId,
        'reason': 'self_harm',
        'note': 'worrying',
      });
    },
  );

  test(
    'a blank note and a missing target user are left out of the body',
    () async {
      api.handler = (_) async => <String, dynamic>{'id': 'report-2'};

      await reportCircleContent(
        ref,
        kind: ReportTargetKind.profile,
        targetId: _userId,
        reason: ReportReason.spam,
        note: '   ',
      );

      expect(api.requests.single.body, {
        'targetKind': 'profile',
        'targetId': _userId,
        'reason': 'spam',
      });
    },
  );

  test('enum wire values match the server contract', () {
    expect(ReportTargetKind.values.map((k) => k.wire), [
      'share',
      'reply',
      'chat_message',
      'profile',
      'chat_group',
    ]);
    expect(ReportReason.values.map((r) => r.wire), [
      'spam',
      'harassment',
      'hate',
      'sexual',
      'violence',
      'self_harm',
      'other',
    ]);
  });

  test('recognises the objectionable-content refusal by code', () {
    expect(
      isObjectionableContentError(
        ApiError(kObjectionableContentCode, 422, false, 'edit it'),
      ),
      isTrue,
    );
    expect(
      isObjectionableContentError(ApiError('NOT_FOUND', 404, false, 'x')),
      isFalse,
    );
    expect(isObjectionableContentError(StateError('x')), isFalse);
  });
}
