import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/settings/data/step_save.dart';
import 'package:kallo_mobile/features/settings/logic/step_session.dart';
import 'package:kallo_mobile/models/profile/onboarding.dart';

import '../onboarding/onboarding_test_support.dart';

class _FakeSaveScreen implements SaveScreenController {
  final posts = <({int step, Map<String, dynamic> data})>[];

  /// When set, the request stays in flight until this completes.
  Completer<void>? inFlight;

  @override
  Future<void> save({
    required int step,
    required Map<String, dynamic> data,
  }) async {
    posts.add((step: step, data: data));
    await inFlight?.future;
  }
}

StepSession _session(SettingsStep step) => StepSession(step, testAnswers(), (
  deviceCountry: null,
  deviceLanguage: 'vi',
  localeFromDevice: false,
));

/// A Settings step page saves through the onboarding step endpoint with its
/// OWN server step, then refetches everything that reads the profile.
void main() {
  late _FakeSaveScreen api;
  late ProviderContainer container;
  late int profileFetches;

  setUp(() {
    api = _FakeSaveScreen();
    profileFetches = 0;
    container = ProviderContainer(
      overrides: [
        saveScreenControllerProvider.overrideWithValue(api),
        profileProvider.overrideWith((ref) async {
          profileFetches++;
          return const ProfileRow({});
        }),
      ],
    );
    addTearDown(container.dispose);
  });

  test(
    'posts the page payload under its server step, then refreshes',
    () async {
      container.listen(profileProvider, (_, _) {});
      await container.read(profileProvider.future);
      expect(profileFetches, 1);

      final session = _session(SettingsStep.cooking);
      session.answers.cooking = session.answers.cooking.copyWith(
        oilUsage: OilUsage.heavy,
      );
      session.changed();

      final saved = await container
          .read(settingsStepSaverProvider)
          .save(session);

      expect(saved, isTrue);
      expect(api.posts.single.step, 3);
      expect(api.posts.single.data['oilUsage'], 'heavy');
      expect(session.dirty, isFalse);
      await container.read(profileProvider.future);
      expect(profileFetches, 2);
    },
  );

  test('nothing postable: no request, the page stays dirty', () async {
    final session = _session(SettingsStep.aboutYou);
    session.answers.weightKg = null;
    session.changed();

    final saved = await container.read(settingsStepSaverProvider).save(session);

    expect(saved, isFalse);
    expect(api.posts, isEmpty);
    expect(session.dirty, isTrue);
  });

  test('an edit made while the save is in flight stays dirty', () async {
    api.inFlight = Completer<void>();
    final session = _session(SettingsStep.cooking);
    session.answers.cooking = session.answers.cooking.copyWith(
      oilUsage: OilUsage.heavy,
    );
    session.changed();

    final pending = container.read(settingsStepSaverProvider).save(session);
    session.answers.cooking = session.answers.cooking.copyWith(
      oilUsage: OilUsage.minimal,
    );
    session.changed();
    api.inFlight!.complete();

    expect(await pending, isTrue);
    expect(api.posts.single.data['oilUsage'], 'heavy');
    expect(session.dirty, isTrue);
    expect(session.payload!['oilUsage'], 'minimal');
  });
}
