/// Consent to send meal text and label photos to the third-party AI (App Store
/// Guideline 5.1.2(i)). Web counterpart: `components/privacy/
/// ai-consent-provider.tsx` + `lib/actions/privacy/ai-consent.ts`.
///
/// The record lives on the profile (`aiProcessingConsentedAt`), so a reinstall
/// does not ask again. The server enforces it — every AI endpoint answers 403
/// `ai_consent_required` without it — and this side only decides when to show
/// the one-time sheet.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/auth/session_provider.dart';
import '../../../services/http/api_client.dart';
import '../../onboarding/data/profile_row.dart';
import '../../onboarding/providers/onboarding_providers.dart';

/// Whether consent is on record: the answer the server last accepted in this
/// session wins over the profile row, which lags behind a write until its
/// refetch lands. Fails closed — no profile reads as no consent.
bool aiConsentOnRecord({bool? recorded, ProfileRow? profile}) =>
    recorded ?? profile?.hasAiConsent ?? false;

/// The last consent answer the server accepted (or refused with a 403) in this
/// session; null until one happens. Rebuilt — so cleared — when the signed-in
/// user changes, so one account's answer never leaks into the next.
class AiConsentRecord extends Notifier<bool?> {
  @override
  bool? build() {
    ref.watch(currentSessionProvider.select((session) => session?.user.id));
    return null;
  }

  /// Grant ([consented] true) or withdraw consent. Returns what the server
  /// stored. The profile is refetched so every other reader re-seeds.
  Future<bool> record(bool consented) async {
    final json = await ref.read(apiClientProvider).put<Map<String, dynamic>>(
      '/api/v1/profile/ai-consent',
      {'consented': consented},
    );
    final stored = json['aiProcessingConsentedAt'] != null;
    state = stored;
    ref.invalidate(profileProvider);
    return stored;
  }

  /// The server refused a request for missing consent: whatever this device
  /// believed (another device may have withdrawn it), it is not on record.
  void markMissing() => state = false;
}

final aiConsentRecordProvider = NotifierProvider<AiConsentRecord, bool?>(
  AiConsentRecord.new,
);

/// Whether an AI request may go out without asking first.
final aiConsentProvider = Provider<bool>(
  (ref) => aiConsentOnRecord(
    recorded: ref.watch(aiConsentRecordProvider),
    profile: ref.watch(profileProvider).valueOrNull,
  ),
);
