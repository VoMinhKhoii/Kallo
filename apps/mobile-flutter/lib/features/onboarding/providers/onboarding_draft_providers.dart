/// Riverpod wiring for the signed-out onboarding draft and the sink the wizard
/// writes every screen through. The wizard never branches on auth itself: this
/// file decides whether a save lands on the server ([ServerOnboardingSink]) or
/// on disk ([DraftOnboardingSink]), and [OnboardingDraftNotifier.flush] replays
/// the draft onto the server after sign-in.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/auth/session_provider.dart';
import '../data/onboarding_draft.dart';
import '../logic/resume_screen.dart';
import 'onboarding_providers.dart';

final onboardingDraftStoreProvider = Provider<OnboardingDraftStore>(
  (ref) => const OnboardingDraftStore(),
);

/// One server step's body, as the screen that completes it built it.
typedef OnboardingStepPayload = ({int step, Map<String, dynamic> data});

/// The draft as it currently sits on disk (`null` when there is none).
class OnboardingDraftNotifier extends AsyncNotifier<OnboardingDraft?> {
  @override
  Future<OnboardingDraft?> build() {
    return ref.read(onboardingDraftStoreProvider).read();
  }

  OnboardingDraftStore get _store => ref.read(onboardingDraftStoreProvider);

  /// Record that the wizard reached [screen], plus that screen's server step
  /// payload when it had one.
  Future<void> record({
    required int screen,
    OnboardingStepPayload? payload,
  }) async {
    final current = state.valueOrNull ?? const OnboardingDraft();
    // Never walk the progress marker backwards: editing an earlier answer must
    // not re-open screens the user already answered.
    final reached =
        screen > current.screenReached ? screen : current.screenReached;
    if (payload == null && reached == current.screenReached) return;
    final next = (payload == null
            ? current
            : current.withStep(payload.step, payload.data))
        .copyWith(screenReached: reached);
    await _store.write(next);
    state = AsyncValue<OnboardingDraft?>.data(next);
  }

  Future<void> clear() async {
    await _store.clear();
    state = const AsyncValue<OnboardingDraft?>.data(null);
  }

  /// Replay a signed-out draft onto the server after sign-in: steps 1, 2, 3 in
  /// order (skipping absent ones), then refresh the profile and drop the draft.
  ///
  /// Cleared ONLY once every post succeeded, so a partial flush retries on the
  /// next launch rather than stranding answers that exist nowhere; a replayed
  /// step is idempotent server-side. Read straight off the store rather than
  /// off `state`, since `/welcome` may be the first thing to ask for the draft.
  Future<void> flush() async {
    final draft = await _store.read();
    if (draft == null || draft.isEmpty) return;

    final controller = ref.read(saveScreenControllerProvider);
    for (var step = 1; step <= 3; step++) {
      final data = draft.stepPayload(step);
      if (data == null) continue;
      await controller.save(step: step, data: data);
    }

    await _store.clear();
    state = const AsyncValue<OnboardingDraft?>.data(null);
    ref.invalidate(profileProvider);
  }
}

final onboardingDraftProvider =
    AsyncNotifierProvider<OnboardingDraftNotifier, OnboardingDraft?>(
      OnboardingDraftNotifier.new,
    );

/// Where one wizard screen's answers go. ONE method, because "the user
/// finished a screen" is one event: [payload] is absent for a skipped screen
/// and for the two that collect half a server step and so post nothing.
abstract class OnboardingSink {
  Future<void> record({required int screen, OnboardingStepPayload? payload});
}

/// Signed in: straight to `POST /api/v1/onboarding/screen`.
///
/// With no payload the server still has to move `onboardingStep`, or Skip loses
/// the user's progress. `saveOnboardingScreen` sets
/// `onboardingStep = max(existing, step)` BEFORE its `hasData` guard
/// (`lib/domain/onboarding/actions.ts`), so an EMPTY payload advances the step
/// without writing a field. Screens 1 and 3 complete no step, so they say
/// nothing.
class ServerOnboardingSink implements OnboardingSink {
  const ServerOnboardingSink(this._controller);

  final SaveScreenController _controller;

  @override
  Future<void> record({
    required int screen,
    OnboardingStepPayload? payload,
  }) async {
    final step = payload?.step ?? onboardingServerStepForScreen(screen);
    if (step == null) return;
    await _controller.save(step: step, data: payload?.data ?? const {});
  }
}

/// Signed out: onto disk, to be flushed once there is a session. The server has
/// no `screenReached` field; the draft is the only thing that keeps it.
class DraftOnboardingSink implements OnboardingSink {
  const DraftOnboardingSink(this._notifier);

  final OnboardingDraftNotifier _notifier;

  @override
  Future<void> record({required int screen, OnboardingStepPayload? payload}) =>
      _notifier.record(screen: screen, payload: payload);
}

/// Picks the sink for the CURRENT auth state.
///
/// `ref.watch`, not a one-shot read of the Supabase client's session: a
/// `Provider` body runs ONCE and caches, which pinned a user who signed in
/// mid-wizard to the draft sink — after the flush had already run.
final onboardingSinkProvider = Provider<OnboardingSink>((ref) {
  final session = ref.watch(currentSessionProvider);
  if (session != null) {
    return ServerOnboardingSink(ref.read(saveScreenControllerProvider));
  }
  return DraftOnboardingSink(ref.read(onboardingDraftProvider.notifier));
});

/// The 1-based WIZARD SCREEN to open on: signed in, the server's step mapped to
/// the first screen of that step; signed out, the one after the furthest the
/// draft reached.
final onboardingResumeScreenProvider = Provider<int>((ref) {
  final session = ref.watch(currentSessionProvider);
  if (session != null) {
    return onboardingScreenForServerStep(
      ref.watch(onboardingResumeStepProvider),
    );
  }
  final draft = ref.watch(onboardingDraftProvider).valueOrNull;
  if (draft == null || draft.isEmpty) return 1;
  return onboardingScreenForDraft(draft.screenReached);
});
