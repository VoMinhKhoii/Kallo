import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/onboarding/data/onboarding_draft.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_draft_providers.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

/// Records every onboarding post so the flush order is assertable, and can be
/// told to fail the Nth one.
class _RecordingApi extends ApiClient {
  _RecordingApi({this.failOnCall = 0});

  /// 1-based index of the call that should throw; 0 = never fail.
  final int failOnCall;
  final List<int> steps = [];

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    final map = body as Map<String, dynamic>;
    steps.add(map['step'] as int);
    if (steps.length == failOnCall) {
      throw ApiError('BOOM', 500, true, 'flush failed');
    }
    return <String, dynamic>{} as T;
  }
}

/// A store whose read never answers — a wedged keychain, or the platform
/// channel a cold start can simply never get a reply from.
class _NeverAnswersStore implements KeyValueStore {
  final _pending = Completer<String?>();

  @override
  Future<String?> read(String key) => _pending.future;

  @override
  Future<void> write(String key, String value) async {}

  @override
  Future<void> delete(String key) async {}
}

ProviderContainer _container({
  required KeyValueStore storage,
  required ApiClient api,
}) {
  final container = ProviderContainer(
    overrides: [
      onboardingDraftStoreProvider
          .overrideWithValue(OnboardingDraftStore(storage: storage)),
      apiClientProvider.overrideWithValue(api),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

const _step1 = {
  'countryOfOrigin': 'Vietnam',
  'countryOfResidence': 'Australia',
  'preferredLocale': 'vi',
};
const _step2 = {'weightKg': 70, 'goal': 'cutting'};
const _step3 = {'oilUsage': 'normal'};

void main() {
  group('OnboardingDraft', () {
    test('round-trips through JSON', () {
      const draft = OnboardingDraft(
        step1: _step1,
        step2: _step2,
        step3: _step3,
        screenReached: 6,
      );
      final restored = OnboardingDraft.fromJson(
        jsonDecode(jsonEncode(draft.toJson())) as Map<String, dynamic>,
      );
      expect(restored.step1, _step1);
      expect(restored.step2, _step2);
      expect(restored.step3, _step3);
      expect(restored.screenReached, 6);
    });

    test('absent steps round-trip as null', () {
      const draft = OnboardingDraft(step1: _step1, screenReached: 2);
      final restored = OnboardingDraft.fromJson(
        jsonDecode(jsonEncode(draft.toJson())) as Map<String, dynamic>,
      );
      expect(restored.step1, _step1);
      expect(restored.step2, isNull);
      expect(restored.step3, isNull);
      expect(restored.screenReached, 2);
    });

    test('screenReached is clamped to the wizard range', () {
      expect(
        OnboardingDraft.fromJson({'screenReached': 99}).screenReached,
        6,
      );
      expect(
        OnboardingDraft.fromJson({'screenReached': -3}).screenReached,
        0,
      );
      expect(
        OnboardingDraft.fromJson({'screenReached': 'six'}).screenReached,
        0,
      );
    });

    test('isComplete needs all three step payloads', () {
      expect(const OnboardingDraft().isComplete, isFalse);
      expect(
        const OnboardingDraft(step1: _step1, step2: _step2).isComplete,
        isFalse,
      );
      expect(
        const OnboardingDraft(step1: _step1, step2: _step2, step3: _step3)
            .isComplete,
        isTrue,
      );
    });

    test('isEmpty is false once anything is recorded', () {
      expect(const OnboardingDraft().isEmpty, isTrue);
      expect(const OnboardingDraft(screenReached: 1).isEmpty, isFalse);
      expect(const OnboardingDraft(step1: _step1).isEmpty, isFalse);
    });

    test('copyWith keeps the fields it is not given', () {
      const draft = OnboardingDraft(step1: _step1, screenReached: 2);
      final next = draft.copyWith(step2: _step2, screenReached: 4);
      expect(next.step1, _step1);
      expect(next.step2, _step2);
      expect(next.screenReached, 4);
    });
  });

  group('OnboardingDraftStore', () {
    test('write then read returns the draft; clear removes it', () async {
      final storage = InMemoryKeyValueStore();
      final store = OnboardingDraftStore(storage: storage);

      expect(await store.read(), isNull);

      await store.write(
        const OnboardingDraft(step1: _step1, screenReached: 2),
      );
      expect(storage.values.keys, [kOnboardingDraftKey]);

      final read = await store.read();
      expect(read!.step1, _step1);
      expect(read.screenReached, 2);

      await store.clear();
      expect(await store.read(), isNull);
      expect(storage.values, isEmpty);
    });

    testWidgets('a read the storage channel never answers times out to no '
        'draft rather than pinning the splash', (tester) async {
      // The router awaits this future before it can decide where a cold start
      // goes; without the timeout a wedged keychain holds the splash forever.
      final store = OnboardingDraftStore(storage: _NeverAnswersStore());
      OnboardingDraft? result;
      Object? failure;
      var done = false;
      unawaited(
        store.read().then(
          (value) {
            result = value;
            done = true;
          },
          onError: (Object e) {
            failure = e;
            done = true;
          },
        ),
      );

      await tester.pump(const Duration(seconds: 2));
      expect(done, isFalse, reason: 'it waits before it gives up');

      await tester.pump(OnboardingDraftStore.readTimeout);
      expect(done, isTrue);
      expect(failure, isNull, reason: 'a timeout is "no draft", not an error');
      expect(result, isNull);
    });

    test('a step whose enum value this build does not know is dropped, not '
        'thrown', () async {
      // `carbSplitFromString` THROWS on an unknown value, and the seed calls it
      // inside the wizard's build — so a draft written by an older build (or
      // by hand) used to take the whole screen down with it.
      final storage = InMemoryKeyValueStore();
      storage.values[kOnboardingDraftKey] = jsonEncode({
        'step1': _step1,
        'step2': {'weightKg': 70, 'goal': 'cutting', 'carbSplit': 'balanced'},
        'step3': _step3,
        'screenReached': 4,
      });

      final draft = await OnboardingDraftStore(storage: storage).read();
      expect(draft, isNotNull);
      expect(draft!.step2, isNull, reason: 'only the offending step goes');
      expect(draft.step1, _step1);
      expect(draft.step3, _step3);
      expect(draft.screenReached, 4);
    });

    test('every enum-shaped field is checked, in both steps', () async {
      Future<OnboardingDraft?> readWith(Map<String, dynamic> json) {
        final storage = InMemoryKeyValueStore();
        storage.values[kOnboardingDraftKey] = jsonEncode(json);
        return OnboardingDraftStore(storage: storage).read();
      }

      for (final field in [
        'biologicalSex',
        'goal',
        'activityLevel',
        'carbSplit',
      ]) {
        final draft = await readWith({
          'step2': {...
            _step2,
            field: 'nonsense',
          },
        });
        expect(draft!.step2, isNull, reason: field);
      }
      for (final field in [
        'oilUsage',
        'defaultRicePortion',
        'sugarBraised',
        'defaultProteinPortion',
        'brothConsumption',
      ]) {
        final draft = await readWith({
          'step3': {...
            _step3,
            field: 'nonsense',
          },
        });
        expect(draft!.step3, isNull, reason: field);
      }

      // A field simply absent is unanswered, not invalid.
      final partial = await readWith({
        'step2': {'weightKg': 70},
      });
      expect(partial!.step2, {'weightKg': 70});
    });

    test('corrupt JSON reads as null instead of throwing', () async {
      final storage = InMemoryKeyValueStore();
      storage.values[kOnboardingDraftKey] = '{not json';
      expect(await OnboardingDraftStore(storage: storage).read(), isNull);

      storage.values[kOnboardingDraftKey] = '[1,2,3]';
      expect(await OnboardingDraftStore(storage: storage).read(), isNull);

      storage.values[kOnboardingDraftKey] = '';
      expect(await OnboardingDraftStore(storage: storage).read(), isNull);
    });
  });

  group('onboardingDraftProvider', () {
    test('record persists the payload and advances screenReached', () async {
      final storage = InMemoryKeyValueStore();
      final container = _container(storage: storage, api: _RecordingApi());
      final notifier = container.read(onboardingDraftProvider.notifier);
      await container.read(onboardingDraftProvider.future);

      await notifier.record(screen: 2, payload: (step: 1, data: _step1));
      await notifier.record(screen: 5, payload: (step: 3, data: _step3));

      final state = container.read(onboardingDraftProvider).value!;
      expect(state.step1, _step1);
      expect(state.step3, _step3);
      expect(state.step2, isNull);
      expect(state.screenReached, 5);

      final onDisk = await OnboardingDraftStore(storage: storage).read();
      expect(onDisk!.screenReached, 5);
    });

    test('screenReached never walks backwards', () async {
      final container = _container(
        storage: InMemoryKeyValueStore(),
        api: _RecordingApi(),
      );
      final notifier = container.read(onboardingDraftProvider.notifier);
      await container.read(onboardingDraftProvider.future);

      await notifier.record(screen: 4);
      await notifier.record(screen: 2, payload: (step: 1, data: _step1));
      await notifier.record(screen: 1);

      expect(container.read(onboardingDraftProvider).value!.screenReached, 4);
    });

    test('clear empties the state and the store', () async {
      final storage = InMemoryKeyValueStore();
      final container = _container(storage: storage, api: _RecordingApi());
      final notifier = container.read(onboardingDraftProvider.notifier);
      await container.read(onboardingDraftProvider.future);

      await notifier.record(screen: 2, payload: (step: 1, data: _step1));
      await notifier.clear();

      expect(container.read(onboardingDraftProvider).value, isNull);
      expect(storage.values, isEmpty);
    });
  });

  group('OnboardingDraftNotifier.flush', () {
    test('posts the present steps in order, then clears the draft', () async {
      final storage = InMemoryKeyValueStore();
      final api = _RecordingApi();
      await OnboardingDraftStore(storage: storage).write(
        const OnboardingDraft(
          step1: _step1,
          step2: _step2,
          step3: _step3,
          screenReached: 6,
        ),
      );

      final container = _container(storage: storage, api: api);
      await container.read(onboardingDraftProvider.notifier).flush();

      expect(api.steps, [1, 2, 3]);
      expect(storage.values, isEmpty);
    });

    test('skips absent steps', () async {
      final storage = InMemoryKeyValueStore();
      final api = _RecordingApi();
      await OnboardingDraftStore(storage: storage).write(
        const OnboardingDraft(step1: _step1, step3: _step3, screenReached: 5),
      );

      final container = _container(storage: storage, api: api);
      await container.read(onboardingDraftProvider.notifier).flush();

      expect(api.steps, [1, 3]);
      expect(storage.values, isEmpty);
    });

    test('a failed post keeps the draft and rethrows', () async {
      final storage = InMemoryKeyValueStore();
      final api = _RecordingApi(failOnCall: 2);
      await OnboardingDraftStore(storage: storage).write(
        const OnboardingDraft(
          step1: _step1,
          step2: _step2,
          step3: _step3,
          screenReached: 6,
        ),
      );

      final container = _container(storage: storage, api: api);
      await expectLater(
        container.read(onboardingDraftProvider.notifier).flush(),
        throwsA(isA<ApiError>()),
      );

      // Step 3 was never attempted and the draft survives for the next launch.
      expect(api.steps, [1, 2]);
      final kept = await OnboardingDraftStore(storage: storage).read();
      expect(kept, isNotNull);
      expect(kept!.step3, _step3);
    });

    test('does nothing when there is no draft', () async {
      final api = _RecordingApi();
      final container = _container(
        storage: InMemoryKeyValueStore(),
        api: api,
      );
      await container.read(onboardingDraftProvider.notifier).flush();
      expect(api.steps, isEmpty);
    });
  });
}
