/// Riverpod ports of the RN onboarding hooks + the gate/completion seam.
///
/// Mirrors:
///   - `lib/onboarding/hooks/use-profile.ts`     → [profileProvider]
///   - `lib/onboarding/hooks/use-save-screen.ts` → [SaveScreenController]
///   - `lib/onboarding/keys.ts`                  → [OnboardingKeys]
///   - `components/onboarding/onboarding-gate.tsx` resume decision →
///     [onboardingResumeProvider]
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api_client.dart';
import '../../../data/query.dart';
import '../../../data/session_provider.dart';
import '../data/profile_row.dart';
import '../logic/progress.dart';

/// React Query keys for the onboarding/profile surface. The profile read shares
/// the SAME key the dashboard/logging screens use (`['onboarding','profile']`)
/// so a settings save invalidates every reader. Invalidations rely on prefix
/// matching — NEVER exact.
abstract final class OnboardingKeys {
  static const List<Object?> all = ['onboarding'];
  static const List<Object?> profile = ['onboarding', 'profile'];
}

/// Loads the user's profile row (or `null` if onboarding never ran). Shares the
/// `['onboarding','profile']` cache concept with the dashboard/logging screens.
///
/// Port of `useProfile`: `queryFn: apiGet('/api/v1/onboarding/profile')`,
/// `staleTime: 60_000`, with the shared retry policy. Only runs when signed in
/// (mirrors the RN `enabled: !!userId`); returns `null` when signed out.
final profileProvider = FutureProvider<ProfileRow?>((ref) async {
  final session = ref.watch(currentSessionProvider);
  if (session == null) return null;

  final api = ref.read(apiClientProvider);
  return runWithRetry(() async {
    final json = await api
        .get<Map<String, dynamic>?>('/api/v1/onboarding/profile');
    return json == null ? null : ProfileRow.fromJson(json);
  });
});

/// Whether the signed-in user still needs to see/resume onboarding.
///
/// Port of `OnboardingGate`'s `incomplete` decision: only a SUCCESSFUL profile
/// fetch can mark onboarding incomplete. A failed/loading fetch leaves the value
/// `false` (do NOT pop the wizard over an existing account, mirroring the RN
/// guard that treats `isSuccess` as the gate).
final onboardingResumeProvider = Provider<bool>((ref) {
  final session = ref.watch(currentSessionProvider);
  if (session == null) return false;

  final profileAsync = ref.watch(profileProvider);
  return profileAsync.maybeWhen(
    data: (profile) {
      final step = profile?.onboardingStep ?? 0;
      return shouldShowOnboardingResume(profile, step);
    },
    orElse: () => false,
  );
});

/// Session-scoped flag: the user closed/skipped out of the FORCED full-page
/// onboarding. The router ANDs `!dismissed` into its force predicate so it
/// doesn't immediately re-route them back (the sidebar dialog still resumes).
/// Resets on app restart — a first-session user gets one nudge per cold start.
final onboardingForceDismissedProvider = StateProvider<bool>((_) => false);

/// The 1-based step the wizard should open on (`getOnboardingResumeStep`).
final onboardingResumeStepProvider = Provider<int>((ref) {
  final profile = ref.watch(profileProvider).valueOrNull;
  final step = profile?.onboardingStep ?? 0;
  return getOnboardingResumeStep(profile, step);
});

/// Imperative port of `useSaveScreen` — `POST /api/v1/onboarding/screen` with
/// `{ step, data }`. Skip = `data: {}` (advances `onboardingStep` without
/// writing fields). On settle, invalidates the profile cache (refreshes targets
/// across dashboard/logging) and the heatmap (targets gate adherence).
class SaveScreenController {
  const SaveScreenController(this._ref);

  final Ref _ref;

  Future<void> save({
    required int step,
    required Map<String, dynamic> data,
  }) async {
    final api = _ref.read(apiClientProvider);
    try {
      await api.post<Map<String, dynamic>>(
        '/api/v1/onboarding/screen',
        {'step': step, 'data': data},
      );
    } finally {
      // onSettled — refresh the shared profile cache + the heatmap.
      _ref.invalidate(profileProvider);
    }
  }
}

final saveScreenControllerProvider = Provider<SaveScreenController>(
  (ref) => SaveScreenController(ref),
);
