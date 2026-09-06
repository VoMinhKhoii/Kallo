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

/// The draft the store reads back out of [raw] on disk.
Future<OnboardingDraft?> _readRaw(String raw) {
  final storage = InMemoryKeyValueStore();
  storage.values[kOnboardingDraftKey] = raw;
  return OnboardingDraftStore(storage: storage).read();
}

Future<OnboardingDraft?> _readJson(Map<String, dynamic> json) =>
    _readRaw(jsonEncode(json));

/// Round-trips [draft] through `toJson`/`fromJson` and real JSON text.
OnboardingDraft _roundTrip(OnboardingDraft draft) => OnboardingDraft.fromJson(
      jsonDecode(jsonEncode(draft.toJson())) as Map<String, dynamic>,
    );

const _step1 = {
  'countryOfOrigin': 'Vietnam',
  'countryOfResidence': 'Australia',
  'preferredLocale': 'vi',
};
const _step2 = {'weightKg': 70, 'goal': 'cutting'};
const _step3 = {'oilUsage': 'normal'};

const _full = OnboardingDraft(
  step1: _step1,
  step2: _step2,
  step3: _step3,
  screenReached: 6,
);

void main() {
  group('OnboardingDraft', () {
    test('round-trips through JSON, absent steps and all', () {
      for (final draft in [
        _full,
        const OnboardingDraft(step1: _step1, screenReached: 2),
      ]) {
        final restored = _roundTrip(draft);
        expect(restored.step1, draft.step1);
        expect(restored.step2, draft.step2);
        expect(restored.step3, draft.step3);
        expect(restored.screenReached, draft.screenReached);
      }
    });

    test('screenReached is clamped to the wizard range', () {
      for (final (stored, expected) in const [
        (99, 6),
        (-3, 0),
        ('six', 0),
      ]) {
        expect(
          OnboardingDraft.fromJson({'screenReached': stored}).screenReached,
          expected,
          reason: '$stored',
        );
      }
    });

    test('isComplete needs all three step payloads', () {
      expect(const OnboardingDraft().isComplete, isFalse);
      expect(
        const OnboardingDraft(step1: _step1, step2: _step2).isComplete,
        isFalse,
      );
      expect(_full.isComplete, isTrue);
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
      // `carbSplitFromString` THROWS, and the seed calls it inside the wizard's
      // build, so an older build's draft used to take the screen down with it.
      final draft = await _readJson({
        'step1': _step1,
        'step2': {'weightKg': 70, 'goal': 'cutting', 'carbSplit': 'balanced'},
        'step3': _step3,
        'screenReached': 4,
      });
      expect(draft, isNotNull);
      expect(draft!.step2, isNull, reason: 'only the offending step goes');
      expect(draft.step1, _step1);
      expect(draft.step3, _step3);
      expect(draft.screenReached, 4);
    });

    test('every enum-shaped field is checked, in both steps', () async {
      for (final field in [
        'biologicalSex',
        'goal',
        'activityLevel',
        'carbSplit',
      ]) {
        final draft = await _readJson({
          'step2': {..._step2, field: 'nonsense'},
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
        final draft = await _readJson({
          'step3': {..._step3, field: 'nonsense'},
        });
        expect(draft!.step3, isNull, reason: field);
      }

      // A field simply absent is unanswered, not invalid.
      final partial = await _readJson({
        'step2': {'weightKg': 70},
      });
      expect(partial!.step2, {'weightKg': 70});
    });

    test('corrupt JSON reads as null instead of throwing', () async {
      for (final raw in const ['{not json', '[1,2,3]', '']) {
        expect(await _readRaw(raw), isNull, reason: raw);
      }
    });
  });

  group('onboardingDraftProvider', () {
    /// A warmed-up container over [storage], with its notifier.
    Future<(ProviderContainer, OnboardingDraftNotifier)> warm(
      KeyValueStore storage,
    ) async {
      final container = _container(storage: storage, api: _RecordingApi());
      final notifier = container.read(onboardingDraftProvider.notifier);
      await container.read(onboardingDraftProvider.future);
      return (container, notifier);
    }

    test('record persists the payload and advances screenReached', () async {
      final storage = InMemoryKeyValueStore();
      final (container, notifier) = await warm(storage);

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
      final (container, notifier) = await warm(InMemoryKeyValueStore());

      await notifier.record(screen: 4);
      await notifier.record(screen: 2, payload: (step: 1, data: _step1));
      await notifier.record(screen: 1);

      expect(container.read(onboardingDraftProvider).value!.screenReached, 4);
    });

    test('clear empties the state and the store', () async {
      final storage = InMemoryKeyValueStore();
      final (container, notifier) = await warm(storage);

      await notifier.record(screen: 2, payload: (step: 1, data: _step1));
      await notifier.clear();

      expect(container.read(onboardingDraftProvider).value, isNull);
      expect(storage.values, isEmpty);
    });
  });

  group('OnboardingDraftNotifier.flush', () {
    /// Puts [draft] on disk, then flushes it through [api].
    Future<InMemoryKeyValueStore> flush(
      ApiClient api, {
      OnboardingDraft? draft,
      bool expectThrow = false,
    }) async {
      final storage = InMemoryKeyValueStore();
      if (draft != null) {
        await OnboardingDraftStore(storage: storage).write(draft);
      }
      final notifier =
          _container(storage: storage, api: api).read(
        onboardingDraftProvider.notifier,
      );
      if (expectThrow) {
        await expectLater(notifier.flush(), throwsA(isA<ApiError>()));
      } else {
        await notifier.flush();
      }
      return storage;
    }

    test('posts the present steps in order, then clears the draft', () async {
      final api = _RecordingApi();
      final storage = await flush(api, draft: _full);

      expect(api.steps, [1, 2, 3]);
      expect(storage.values, isEmpty);
    });

    test('skips absent steps', () async {
      final api = _RecordingApi();
      final storage = await flush(
        api,
        draft: const OnboardingDraft(
          step1: _step1,
          step3: _step3,
          screenReached: 5,
        ),
      );

      expect(api.steps, [1, 3]);
      expect(storage.values, isEmpty);
    });

    test('a failed post keeps the draft and rethrows', () async {
      final api = _RecordingApi(failOnCall: 2);
      final storage = await flush(api, draft: _full, expectThrow: true);

      // Step 3 was never attempted and the draft survives for the next launch.
      expect(api.steps, [1, 2]);
      final kept = await OnboardingDraftStore(storage: storage).read();
      expect(kept, isNotNull);
      expect(kept!.step3, _step3);
    });

    test('does nothing when there is no draft', () async {
      final api = _RecordingApi();
      await flush(api);
      expect(api.steps, isEmpty);
    });
  });
}
