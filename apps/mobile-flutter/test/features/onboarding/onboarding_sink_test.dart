// Where a wizard step's answers land, and what "progress with no payload"
// means on each side of the auth line: signed out a local `screenReached`,
// signed in an empty payload that advances `onboardingStep` — the server takes
// `max(existing, step)` before it looks at the data.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:kallo_mobile/features/onboarding/data/onboarding_draft.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_draft_providers.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import 'onboarding_test_support.dart';

typedef _Post = ({int step, Map<String, dynamic> data});

/// Stands in for the network under [SaveScreenController] — the controller
/// itself is the thing under test, so it is the real one.
class _RecordingApi extends ApiClient {
  final List<_Post> posts = [];

  @override
  Future<T> get<T>(String path) async => <String, dynamic>{} as T;

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    final map = body! as Map<String, dynamic>;
    posts.add((
      step: map['step'] as int,
      data: map['data'] as Map<String, dynamic>,
    ));
    return <String, dynamic>{} as T;
  }
}

void main() {
  test('signed in, a screen with no payload still advances the SERVER step',
      () async {
    final api = _RecordingApi();
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        currentSessionProvider.overrideWith((ref) => testSession()),
      ],
    );
    addTearDown(container.dispose);

    final sink = container.read(onboardingSinkProvider);
    expect(sink, isA<ServerOnboardingSink>());
    for (var screen = 1; screen <= 6; screen++) {
      await sink.record(screen: screen);
    }

    // Screens 1 and 3 collect HALF a step each, so they post nothing; the
    // other four post the step they would have filled.
    expect(api.posts.map((p) => p.step).toList(), [1, 2, 3, 2]);
    expect(api.posts.every((p) => p.data.isEmpty), isTrue,
        reason: 'an empty payload moves the step without writing a field');
  });

  test('signed out, the same call only moves the local marker', () async {
    final storage = InMemoryKeyValueStore();
    final api = _RecordingApi();
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        currentSessionProvider.overrideWith((ref) => null),
        onboardingDraftStoreProvider
            .overrideWithValue(OnboardingDraftStore(storage: storage)),
      ],
    );
    addTearDown(container.dispose);
    await container.read(onboardingDraftProvider.future);

    final sink = container.read(onboardingSinkProvider);
    expect(sink, isA<DraftOnboardingSink>());
    await sink.record(screen: 2);

    expect(api.posts, isEmpty);
    expect(container.read(onboardingDraftProvider).value?.screenReached, 2);
  });

  test('the sink flips from draft to server the moment the session appears',
      () async {
    final events = StreamController<AuthState>.broadcast();
    addTearDown(events.close);
    final api = _RecordingApi();
    final storage = InMemoryKeyValueStore();
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        // The real seam: gotrue's event stream plus the synchronous read.
        authEventsProvider.overrideWithValue(events.stream),
        currentSessionReaderProvider.overrideWithValue(() => null),
        onboardingDraftStoreProvider
            .overrideWithValue(OnboardingDraftStore(storage: storage)),
      ],
    );
    addTearDown(container.dispose);

    final subscription = container.listen(onboardingSinkProvider, (_, _) {});
    addTearDown(subscription.close);
    await container.read(onboardingDraftProvider.future);
    await container.pump();

    expect(container.read(onboardingSinkProvider), isA<DraftOnboardingSink>());
    await container.read(onboardingSinkProvider).record(
          screen: 2,
          payload: (step: 1, data: const {'preferredLocale': 'vi'}),
        );
    expect(api.posts, isEmpty);

    events.add(AuthState(AuthChangeEvent.signedIn, testSession()));
    // Two hops: the stream's delivery, then the provider rebuild.
    await Future<void>.delayed(Duration.zero);
    await container.pump();

    // Mid-wizard sign-in: the very next save has to land on the server, or the
    // answers pile up in a draft whose flush already ran.
    expect(container.read(onboardingSinkProvider), isA<ServerOnboardingSink>());
    await container.read(onboardingSinkProvider).record(
          screen: 5,
          payload: (step: 3, data: const {'oilUsage': 'heavy'}),
        );

    expect(api.posts, hasLength(1));
    expect(api.posts.single.step, 3);
    expect(api.posts.single.data, {'oilUsage': 'heavy'});
  });
}
