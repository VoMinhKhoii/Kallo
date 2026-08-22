import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/models/social/chat_group.dart';
import 'package:kallo_mobile/models/social/circle.dart';

Map<String, dynamic> _feedEntryJson({
  Object? portionFactor = 1,
  Object? caloriesKcal = '540',
  Object? proteinG = 38,
  Object? carbohydrateG = '62',
  Object? fatG = 14,
  Object? avatarUrl,
}) => {
  'friend': {
    'userId': 'friend-1',
    'handle': 'ha_noi_eats',
    'displayName': 'Hà',
    'avatarSeed': 'ha-seed',
    'avatarUrl': avatarUrl,
  },
  'isSelf': false,
  'meal': {
    'mealId': 'meal-1',
    'shareId': 'share-1',
    'rawInput': 'Bún chả Hà Nội',
    'caloriesKcal': caloriesKcal,
    'proteinG': proteinG,
    'carbohydrateG': carbohydrateG,
    'fatG': fatG,
    'portionFactor': portionFactor,
    'sharedAt': '2026-07-18T03:04:05.000Z',
  },
};

void main() {
  group('Circle feed models', () {
    test('parses numeric portionFactor and num-or-string macros', () {
      final entry = CircleFeedEntry.fromJson(
        _feedEntryJson(portionFactor: 0.5),
      );

      expect(entry.meal.portionFactor, 0.5);
      expect(entry.meal.caloriesKcal, 540);
      expect(entry.meal.proteinG, 38);
      expect(entry.meal.carbohydrateG, 62);
      expect(entry.meal.fatG, 14);
      expect(entry.meal.rawInput, 'Bún chả Hà Nội');
    });

    test('parses string portionFactor and preserves null macros', () {
      final entry = CircleFeedEntry.fromJson(
        _feedEntryJson(
          portionFactor: '0.5',
          caloriesKcal: null,
          proteinG: null,
          carbohydrateG: null,
          fatG: null,
        ),
      );

      expect(entry.meal.portionFactor, 0.5);
      expect(entry.meal.caloriesKcal, isNull);
      expect(entry.meal.proteinG, isNull);
      expect(entry.meal.carbohydrateG, isNull);
      expect(entry.meal.fatG, isNull);
    });

    test('defaults absent factor, reactions, replies, and reply total', () {
      final json = _feedEntryJson();
      (json['meal'] as Map<String, dynamic>).remove('portionFactor');
      final entry = CircleFeedEntry.fromJson(json);

      expect(entry.meal.portionFactor, 1);
      expect(entry.meal.isBackfilled, isFalse);
      expect(entry.reactions.count, 0);
      expect(entry.reactions.mine, isFalse);
      expect(entry.replies, isEmpty);
      expect(entry.repliesTotal, 0);
    });

    test('parses isBackfilled flag on a shared meal', () {
      final json = _feedEntryJson();
      (json['meal'] as Map<String, dynamic>)['isBackfilled'] = true;
      final entry = CircleFeedEntry.fromJson(json);

      expect(entry.meal.isBackfilled, isTrue);
    });

    test('parses reactions, replies, and a feed page cursor', () {
      final json = _feedEntryJson(avatarUrl: 'https://cdn.example/ha.jpg')
        ..addAll({
          'reactions': {'count': 3, 'mine': true},
          'replies': [
            {
              'id': 'reply-1',
              'author': {
                'userId': 'friend-2',
                'handle': 'linh',
                'displayName': 'Linh',
                'avatarSeed': null,
                'avatarUrl': 'https://cdn.example/linh.jpg',
              },
              'isSelf': true,
              'body': 'Ngon quá!',
              'createdAt': '2026-07-18T04:05:06.000Z',
            },
          ],
          'repliesTotal': 4,
        });
      final page = SharedMealFeedPage.fromJson({
        'entries': [json],
        'nextCursor': 'opaque-cursor',
      });

      final entry = page.entries.single;
      final reply = entry.replies.single;
      expect(page.nextCursor, 'opaque-cursor');
      expect(entry.friend.avatarUrl, 'https://cdn.example/ha.jpg');
      expect(entry.reactions.count, 3);
      expect(entry.reactions.mine, isTrue);
      expect(entry.repliesTotal, 4);
      expect(reply.id, 'reply-1');
      expect(reply.author.avatarUrl, 'https://cdn.example/linh.jpg');
      expect(reply.isSelf, isTrue);
      expect(reply.body, 'Ngon quá!');
      expect(reply.createdAt, DateTime.utc(2026, 7, 18, 4, 5, 6));
    });

    test('distinguishes null and string avatar URLs', () {
      final withoutAvatar = CircleFeedEntry.fromJson(_feedEntryJson());
      final withAvatar = CircleFeedEntry.fromJson(
        _feedEntryJson(avatarUrl: 'https://cdn.example/avatar.jpg'),
      );

      expect(withoutAvatar.friend.avatarUrl, isNull);
      expect(withAvatar.friend.avatarUrl, 'https://cdn.example/avatar.jpg');
    });
  });

  group('Chat group models', () {
    test('parses identity kind and unread state', () {
      final identity = ChatGroupIdentity.fromJson(const {
        'id': 'group-1',
        'kind': 'group',
        'title': 'Hội bún chả',
        'avatarSeed': 'group-seed',
        'updatedAt': '2026-07-18T04:00:00.000Z',
        'lastMessagePreview': null,
        'lastMessageAt': null,
        'unread': true,
        'lastMealSharedAt': '2026-07-18T03:00:00.000Z',
      });
      final direct = ChatGroupIdentity.fromJson(const {
        'id': 'direct-1',
        'kind': 'direct',
        'title': 'Linh',
        'avatarSeed': null,
        'updatedAt': '2026-07-18T02:00:00.000Z',
        'lastMessagePreview': 'Ăn trưa chưa?',
        'lastMessageAt': '2026-07-18T02:00:00.000Z',
        'unread': false,
        'lastMealSharedAt': null,
      });

      expect(identity.kind, 'group');
      expect(identity.unread, isTrue);
      expect(identity.title, 'Hội bún chả');
      expect(direct.kind, 'direct');
      expect(direct.unread, isFalse);
    });

    test('parses group detail role and flat member identity', () {
      final detail = ChatGroupDetail.fromJson(const {
        'id': 'group-1',
        'kind': 'group',
        'name': 'Hội bún chả',
        'members': [
          {
            'userId': 'owner-1',
            'handle': 'hanoi_owner',
            'displayName': 'Chủ nhóm',
            'avatarSeed': 'owner-seed',
            'avatarUrl': null,
            'role': 'owner',
          },
        ],
        'myRole': 'owner',
      });
      final memberDetail = ChatGroupDetail.fromJson(const {
        'id': 'group-2',
        'kind': 'group',
        'name': 'Bạn ăn trưa',
        'members': <dynamic>[],
        'myRole': 'member',
      });

      expect(detail.myRole, 'owner');
      expect(detail.members.single.role, 'owner');
      expect(detail.members.single.userId, 'owner-1');
      expect(detail.members.single.avatarUrl, isNull);
      expect(memberDetail.myRole, 'member');
    });
  });
}
