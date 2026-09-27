import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/privacy/data/ai_consent_providers.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

/// Records PUTs and answers with a canned consent state — never touches HTTP.
class FakeApiClient extends ApiClient {
  final List<(String, Object?)> puts = [];
  Object? Function(Object? body)? reply;

  @override
  Future<T> put<T>(String path, [Object? body]) async {
    puts.add((path, body));
    return reply!(body) as T;
  }
}

const _consentedAt = '2026-09-25T12:10:00.000Z';

ProfileRow _profile({String? consentedAt}) => ProfileRow({
  'onboardingStep': 3,
  if (consentedAt != null) 'aiProcessingConsentedAt': consentedAt,
});

void main() {
  group('ProfileRow.hasAiConsent', () {
    test('reads a stored timestamp as consent', () {
      final row = _profile(consentedAt: _consentedAt);
      expect(row.hasAiConsent, isTrue);
      expect(row.aiProcessingConsentedAt, DateTime.parse(_consentedAt));
    });

    test('fails closed on a missing, null or garbled field', () {
      expect(_profile().hasAiConsent, isFalse);
      expect(
        const ProfileRow({'aiProcessingConsentedAt': null}).hasAiConsent,
        false,
      );
      expect(
        const ProfileRow({'aiProcessingConsentedAt': 'soon'}).hasAiConsent,
        false,
      );
    });
  });

  group('aiConsentOnRecord — the gate decision', () {
    test('no profile and no answer this session asks', () {
      expect(aiConsentOnRecord(), isFalse);
    });

    test('follows the profile row when nothing was answered this session', () {
      expect(
        aiConsentOnRecord(profile: _profile(consentedAt: _consentedAt)),
        isTrue,
      );
      expect(aiConsentOnRecord(profile: _profile()), isFalse);
    });

    test('an answer from this session wins over a profile that lags it', () {
      // Just agreed; the profile refetch has not landed yet.
      expect(aiConsentOnRecord(recorded: true, profile: _profile()), isTrue);
      // Server said 403 although the cached profile still shows consent.
      expect(
        aiConsentOnRecord(
          recorded: false,
          profile: _profile(consentedAt: _consentedAt),
        ),
        isFalse,
      );
    });
  });

  group('AiConsentRecord.record', () {
    late FakeApiClient api;
    late ProviderContainer container;
    var profileFetches = 0;

    setUp(() {
      api = FakeApiClient();
      profileFetches = 0;
      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          currentSessionProvider.overrideWith((ref) => null),
          profileProvider.overrideWith((ref) async {
            profileFetches++;
            return _profile();
          }),
        ],
      );
      addTearDown(container.dispose);
    });

    test('PUTs consent, records it and refetches the profile', () async {
      api.reply = (_) => {'aiProcessingConsentedAt': _consentedAt};
      await container.read(profileProvider.future);
      expect(container.read(aiConsentProvider), isFalse);

      final stored = await container
          .read(aiConsentRecordProvider.notifier)
          .record(true);

      expect(stored, isTrue);
      // Records compare maps by identity, so check the two halves apart.
      expect(api.puts.single.$1, '/api/v1/profile/ai-consent');
      expect(api.puts.single.$2, {'consented': true});
      expect(container.read(aiConsentProvider), isTrue);
      await container.read(profileProvider.future);
      expect(profileFetches, 2);
    });

    test(
      'withdrawing records "not consented" and the gate asks again',
      () async {
        api.reply = (_) => {'aiProcessingConsentedAt': null};

        final stored = await container
            .read(aiConsentRecordProvider.notifier)
            .record(false);

        expect(stored, isFalse);
        expect(api.puts.single.$2, {'consented': false});
        expect(container.read(aiConsentProvider), isFalse);
      },
    );

    test('a failed write leaves the recorded answer untouched', () async {
      api.reply = (_) => throw Exception('offline');

      await expectLater(
        container.read(aiConsentRecordProvider.notifier).record(true),
        throwsException,
      );
      expect(container.read(aiConsentRecordProvider), isNull);
    });

    test('markMissing overrides a profile that still shows consent', () async {
      container.read(aiConsentRecordProvider.notifier).markMissing();
      expect(container.read(aiConsentRecordProvider), isFalse);
      expect(container.read(aiConsentProvider), isFalse);
    });
  });
}
