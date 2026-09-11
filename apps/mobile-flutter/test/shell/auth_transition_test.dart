// The provider graph the router runs on, driven through a real sign-in.
//
// This is the altitude the branch's earlier tests missed. They each pinned one
// seam — a gesture, a stack shape, a layout — and every one of them passed
// while the app died on a TestFlight build the moment a user finished
// onboarding and signed in with Apple. Nothing exercised the graph itself
// while auth flipped, which is where the defect lived.
//
// `onboardingResumeProvider` is the element that broke. It watches BOTH
// `currentSessionProvider` and `profileProvider`, and `profileProvider` watches
// `currentSessionProvider` too — so one session change schedules the resume
// provider for refresh AND marks its dependency map as maybe-changed. The
// scheduler then flushes it by walking that map and rebuilding `profileProvider`
// on the way through. `router.dart` listens to `profileProvider`, and that
// listener used to re-enter the graph synchronously (ping -> go_router's
// synchronous re-parse -> a redirect that reads seven providers), rebuilding
// the resume provider while the scheduler was still iterating its dependencies.
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/onboarding/data/constants.dart';
// Aliased: both this and `onboarding_providers` are imported for the four
// providers `router.dart` listens to, and each declares a `profileProvider`.
import 'package:kallo_mobile/features/onboarding/providers/onboarding_draft_providers.dart'
    as draft;
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/shell/nav/router_refresh.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

Session _session(String id) => Session(
  accessToken: 'access-$id',
  tokenType: 'bearer',
  refreshToken: 'refresh-$id',
  user: User(
    id: id,
    appMetadata: const {},
    userMetadata: const {},
    aud: 'authenticated',
    createdAt: DateTime.utc(2026).toIso8601String(),
    lastSignInAt: DateTime.utc(2026).toIso8601String(),
  ),
);

/// Answers the profile GET the resume decision turns on: a FINISHED profile —
/// every step done and personalization saved — so the redirect settles on the
/// app instead of bouncing the user back into the wizard.
class _ProfileApi extends ApiClient {
  static const _profile = <String, dynamic>{
    'onboardingStep': kOnboardingTotalSteps,
    'calorieTarget': 2100,
    'weightKg': 64.5,
  };

  @override
  Future<T> get<T>(String path) async => _profile as T;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    // The draft provider reads secure storage on its first build.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
          (call) async => null,
        );
  });

  testWidgets('signing in settles the router graph without tearing it', (
    tester,
  ) async {
    final events = StreamController<AuthState>.broadcast();
    Session? current;

    final container = ProviderContainer(
      overrides: [
        authEventsProvider.overrideWithValue(events.stream),
        currentSessionReaderProvider.overrideWithValue(() => current),
        apiClientProvider.overrideWithValue(_ProfileApi()),
      ],
    );
    final refresh = RouterRefresh(events.stream);

    // A real scope, because the SCHEDULING is what this test is about:
    // `UncontrolledProviderScope` hands Riverpod the widget vsync, so every
    // change made during a frame is batched and flushed together at the start
    // of the next one — from inside the build phase, which is where the
    // production stack trace begins. A bare `ProviderContainer` uses a plain
    // `Future` instead and never reproduces the ordering.
    await tester.pumpWidget(
      UncontrolledProviderScope(container: container, child: const SizedBox()),
    );

    // `router.dart`'s listener topology, verbatim.
    container.listen(profileProvider, (_, _) => refresh.ping());
    container.listen(onboardingResumeProvider, (_, _) => refresh.ping());
    container.listen(onboardingForceDismissedProvider, (_, _) => refresh.ping());
    container.listen(draft.onboardingDraftProvider, (_, _) => refresh.ping());

    // What go_router does with that notification: re-parse, which runs the
    // redirect — seven synchronous provider reads — in the notifier's own
    // stack frame. (`router_refresh_test.dart` proves the synchronicity.)
    var redirects = 0;
    refresh.addListener(() {
      redirects += 1;
      container.read(sessionProvider);
      container.read(currentSessionReaderProvider)();
      container.read(draft.onboardingDraftProvider);
      container.read(profileProvider);
      container.read(onboardingForceDismissedProvider);
      container.read(onboardingResumeProvider);
      container.read(pendingInviteSlugProvider);
    });

    // Cold start, signed out: let the graph settle where a launch leaves it.
    container.listen(sessionProvider, (_, _) {}, fireImmediately: true);
    await tester.pumpAndSettle();

    // Which of the two stale ancestors the scheduler reaches first decides
    // whether this bites, and that order is `currentSessionProvider`'s
    // dependent list — which every rebuild reshuffles, because a rebuilding
    // element unsubscribes and re-subscribes at the end. That is why the user
    // saw the crash "sometimes". Pin it to the losing arrangement: the resume
    // provider re-watches the session last, which is where any profile refresh
    // during onboarding leaves it.
    container.invalidate(onboardingResumeProvider);
    container.read(onboardingResumeProvider);

    // The moment under test — onboarding finished, then "Continue with Apple".
    // `FirstRunFinish` invalidates the profile on the way out of the wizard and
    // the sign-in lands on top of it, IN THE SAME FRAME: the resume provider is
    // now both scheduled for refresh (its watched profile was invalidated) and
    // carrying a maybe-changed dependency map (its watched session flipped).
    // That pair of flags is what sends the scheduler walking the map.
    container.invalidate(profileProvider);
    current = _session('user-1');
    events.add(AuthState(AuthChangeEvent.signedIn, current));

    // Nothing may read the graph in between — the batch is the bug.
    await tester.pumpAndSettle();

    // Without the deferral this is a `ConcurrentModificationError` or a
    // `StateError` off an element caught mid-rebuild, depending on which
    // provider the re-entrant read lands on. Either way it is thrown in the
    // build phase, uncaught, and the screen dies.
    expect(
      tester.takeException(),
      isNull,
      reason: 'the sign-in tore the provider graph',
    );

    // The graph really did transition — otherwise the assertion above is
    // vacuous and would pass on a graph that never woke up.
    expect(redirects, greaterThan(0));
    expect(container.read(currentSessionProvider)?.user.id, 'user-1');
    expect(
      container.read(profileProvider).valueOrNull?.onboardingStep,
      kOnboardingTotalSteps,
    );
    expect(container.read(onboardingResumeProvider), isFalse);

    refresh.dispose();
    await events.close();
    container.dispose();
  });
}
