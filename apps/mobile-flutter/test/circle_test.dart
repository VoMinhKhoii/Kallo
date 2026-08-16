import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/circle_deep_links.dart';
import 'package:kallo_mobile/shared/widgets/profile_avatar.dart';
import 'package:kallo_mobile/models/circle.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    // easy_localization persists the locale via shared_preferences.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  group('CircleProfile.label / initial', () {
    test('prefers a trimmed display name, else the handle', () {
      expect(
        const CircleProfile(
          userId: 'u',
          handle: 'alice_1',
          displayName: '  Alice  ',
        ).label,
        'Alice',
      );
      expect(
        const CircleProfile(
          userId: 'u',
          handle: 'alice_1',
          displayName: '   ',
        ).label,
        'alice_1',
      );
      expect(const CircleProfile(userId: 'u', handle: 'alice_1').initial, 'A');
    });
  });

  group('CircleFeedEntry.fromJson', () {
    test('parses friend + meal, macros as doubles, isSelf default false', () {
      final entry = CircleFeedEntry.fromJson(const {
        'friend': {
          'userId': 'u2',
          'handle': 'bob',
          'displayName': null,
          'avatarSeed': 'bob',
        },
        'meal': {
          'mealId': 'm1',
          'shareId': 's1',
          'rawInput': '2 bowls phở',
          'caloriesKcal': 540,
          'proteinG': 30,
          'carbohydrateG': null,
          'fatG': 12.5,
          'sharedAt': '2026-07-01T09:00:00Z',
        },
      });

      expect(entry.isSelf, false);
      expect(entry.friend.label, 'bob');
      expect(entry.meal.rawInput, '2 bowls phở');
      expect(entry.meal.caloriesKcal, 540.0);
      expect(entry.meal.carbohydrateG, isNull);
      expect(entry.meal.fatG, 12.5);
    });
  });

  group('InvitePreview.fromJson', () {
    test('maps status strings to relations and reads signedOut', () {
      InvitePreview parse(String? status, {bool signedOut = false}) =>
          InvitePreview.fromJson({
            'inviter': const {'userId': 'u', 'handle': 'alice'},
            'status': status,
            'signedOut': signedOut,
          });

      expect(parse('self').relation, InviteRelation.self);
      expect(parse('accepted').relation, InviteRelation.accepted);
      expect(parse('blocked').relation, InviteRelation.blocked);
      expect(parse('none').relation, InviteRelation.none);
      expect(parse(null).relation, InviteRelation.none);
      expect(parse('none', signedOut: true).signedOut, true);
    });
  });

  group('inviteSlugFrom', () {
    test('extracts the slug from custom-scheme and https invite links', () {
      expect(inviteSlugFrom(Uri.parse('nham://invite/alice_1')), 'alice_1');
      expect(
        inviteSlugFrom(Uri.parse('https://nham.app/en/invite/bob')),
        'bob',
      );
      expect(
        inviteSlugFrom(Uri.parse('https://nham.app/invite/carol')),
        'carol',
      );
    });

    test('lowercases the slug (handles are stored lowercase)', () {
      expect(inviteSlugFrom(Uri.parse('nham://invite/Alice_1')), 'alice_1');
      expect(
        inviteSlugFrom(Uri.parse('https://nham.app/en/invite/BOB')),
        'bob',
      );
    });

    test('returns null for non-invite links', () {
      expect(inviteSlugFrom(Uri.parse('nham://auth-callback')), isNull);
      expect(inviteSlugFrom(Uri.parse('https://nham.app/dashboard')), isNull);
    });
  });

  group('discTintIndex', () {
    test(
      'replicates the web signed-32-bit hash (same tint cross-platform)',
      () {
        // 'alice' hashes to 92903040 under the JS `hash*31+code|0` scheme.
        expect(discTintIndex(null, 'alice'), 92903040 % 3);
      },
    );

    test('is deterministic and prefers the seed over the handle', () {
      final a = discTintIndex('seed_x', 'ignored');
      final b = discTintIndex('seed_x', 'other_handle');
      expect(a, b);
      expect(a, inInclusiveRange(0, 2));
    });
  });

  group('MealShareInvite.fromJson', () {
    test('parses a split invite with sender + portioned macros', () {
      final invite = MealShareInvite.fromJson(const {
        'id': 'inv-1',
        'mode': 'split',
        'portionFactor': 0.5,
        'createdAt': '2026-04-05T10:00:00.000Z',
        'from': {'userId': 'u2', 'handle': 'bob', 'displayName': 'Bob'},
        'meal': {
          'rawInput': 'Trà sữa',
          'caloriesKcal': 100,
          'proteinG': 2,
          'carbohydrateG': 20,
          'fatG': 2.5,
        },
      });

      expect(invite.isSplit, isTrue);
      expect(invite.portionFactor, 0.5);
      expect(invite.from.label, 'Bob');
      expect(invite.rawInput, 'Trà sữa');
      expect(invite.caloriesKcal, 100);
      expect(invite.fatG, 2.5);
    });

    test('defaults mode to copy and factor to 1, tolerates null macros', () {
      final invite = MealShareInvite.fromJson(const {
        'id': 'inv-2',
        'from': {'userId': 'u3', 'handle': 'cara'},
        'meal': {'rawInput': 'Phở bò'},
      });

      expect(invite.isSplit, isFalse);
      expect(invite.mode, 'copy');
      expect(invite.portionFactor, 1);
      expect(invite.caloriesKcal, isNull);
      expect(invite.from.label, 'cara');
    });
  });
}
