import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:kallo_mobile/features/onboarding/data/onboarding_draft.dart';
import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_draft_providers.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/onboarding/widgets/onboarding_wizard.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/shared/widgets/form/option_row.dart';
import 'package:kallo_mobile/shared/widgets/list/list_row.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';

import 'onboarding_test_support.dart';

/// A profile with every body metric filled, so screens 4 and 6 have a step-2
/// payload to post.
const _profile = ProfileRow({
  'onboardingStep': 0,
  'biologicalSex': 'male',
  'weightKg': 70,
  'heightCm': 175,
  'age': 30,
  'activityLevel': 'light',
  'goal': 'cutting',
  'aggression': '0.5',
  'carbSplit': 'moderate_carb',
  'countryOfOrigin': 'Vietnam',
  'countryOfResidence': 'Vietnam',
  'preferredLocale': 'en',
});

/// [sessions] opts the host into the REAL auth wiring: the session arrives on
/// a stream the test drives, the profile answers `null` until it has, and the
/// resume screen is computed rather than handed over.
Widget _app(
  FakeOnboardingSink sink, {
  int resumeScreen = 1,
  ProfileRow? profile,
  Stream<Session?>? sessions,
  int profileFailures = 0,
  VoidCallback? onComplete,
  VoidCallback? onClose,
}) {
  // Counted across invalidations, so a test can fail the first signed-in fetch
  // and let the retry succeed.
  var failuresLeft = profileFailures;
  return ProviderScope(
    overrides: [
      onboardingSinkProvider.overrideWithValue(sink),
      if (sessions == null)
        onboardingResumeScreenProvider.overrideWithValue(resumeScreen),
      if (sessions != null) sessionProvider.overrideWith((ref) => sessions),
      profileProvider.overrideWith((ref) async {
        if (sessions == null) return profile;
        if (ref.watch(currentSessionProvider) == null) return null;
        if (failuresLeft > 0) {
          failuresLeft--;
          throw StateError('profile unreachable');
        }
        return profile;
      }),
      // Keeps the draft notifier off the secure-storage platform channel.
      onboardingDraftStoreProvider.overrideWithValue(
        OnboardingDraftStore(storage: InMemoryKeyValueStore()),
      ),
    ],
    child: localizedHome(
      Builder(
        builder: (inner) => MediaQuery(
          // The bun breathes on an endless Ticker (`pumpAndSettle` would hang);
          // reduced motion also drops the typewriter.
          data: MediaQuery.of(inner).copyWith(disableAnimations: true),
          child: Scaffold(
            backgroundColor: kPage,
            body: SafeArea(
              child: OnboardingWizard(
                onComplete: onComplete ?? () {},
                onClose: onClose,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/// Pumps a fixed number of frames — never `pumpAndSettle`, which the mascot's
/// ticker would hang forever.
Future<void> _frames(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 120));
  }
}

Future<void> _boot(WidgetTester tester, Widget app) async {
  tester.view.physicalSize = const Size(390, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(app);
  await _frames(tester);
}

Future<void> _tap(WidgetTester tester, String label) async {
  await tester.tap(find.text(label));
  await _frames(tester);
}

/// Continue through screens 1–5, then Save my plan on 6.
Future<void> _walkToEnd(WidgetTester tester) async {
  for (var i = 0; i < 5; i++) {
    await _tap(tester, 'Continue');
  }
  await _tap(tester, 'Save my plan');
}

/// Whether the [OptionRow] carrying [label] is the chosen one.
bool _selected(WidgetTester tester, String label) => tester
    .widgetList<OptionRow>(find.byType(OptionRow))
    .firstWhere((row) => row.label == label)
    .selected;

bool _ctaDisabled(WidgetTester tester) =>
    tester.widget<KalloButton>(find.byType(KalloButton)).disabled;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(initOnboardingTest);

  testWidgets('walks six screens, posting the three server steps at the four '
      'screens that own them with the payloads they own', (tester) async {
    final sink = FakeOnboardingSink();
    var completed = 0;
    await _boot(
      tester,
      _app(sink, profile: _profile, onComplete: () => completed++),
    );

    const titles = [
      'Choose your language',
      'Where do you cook?',
      'About you',
      'Your goal',
      'Your cooking habits',
      'Your daily target',
    ];
    final semantics = tester.ensureSemantics();
    for (var i = 0; i < titles.length; i++) {
      expect(find.text(titles[i]), findsOneWidget, reason: titles[i]);
      expect(find.bySemanticsLabel('Step ${i + 1} of 6'), findsOneWidget);
      await _tap(tester, i == titles.length - 1 ? 'Save my plan' : 'Continue');
    }

    // Screens 1 and 3 collect half a step each: progress only.
    expect(sink.reached, [1, 3]);
    // 2 → step 1, 4 → step 2, 5 → step 3, 6 → step 2 again.
    expect(
      sink.saves.map((s) => (s.step, s.screenReached)).toList(),
      [(1, 2), (2, 4), (3, 5), (2, 6)],
    );
    expect(completed, 1);
    semantics.dispose();

    // …and each post carries the payload its server step expects.
    final step1 = sink.saves.firstWhere((s) => s.step == 1).data;
    expect(step1.keys.toSet(), {
      'countryOfOrigin',
      'countryOfResidence',
      'preferredLocale',
    });
    expect(step1['countryOfOrigin'], 'Vietnam');
    expect(step1['preferredLocale'], 'en');

    final step2 = sink.saves.firstWhere((s) => s.step == 2).data;
    expect(step2['biologicalSex'], 'male');
    expect(step2['weightKg'], 70.0);
    expect(step2['goal'], 'cutting');
    // The derived targets travel with it — the server stores what was shown.
    expect(step2['tdeeKcal'], isA<int>());
    expect(step2['calorieTarget'], (step2['tdeeKcal'] as int) - 550);

    final step3 = sink.saves.firstWhere((s) => s.step == 3).data;
    expect(step3, {
      'oilUsage': 'normal',
      'defaultRicePortion': 'medium',
      'sugarBraised': 'medium',
      'defaultProteinPortion': 'medium',
      'brothConsumption': 'some',
    });
  });

  testWidgets('with no metrics the step-2 screens advance without posting',
      (tester) async {
    final sink = FakeOnboardingSink();
    await _boot(tester, _app(sink));
    await _walkToEnd(tester);

    expect(sink.saves.map((s) => s.step).toList(), [1, 3]);
    // The screens still happened, so the resume marker still moved.
    expect(sink.reached, [1, 3, 4, 6]);
    expect(find.text('Fill the basics to unlock targets.'), findsOneWidget);
  });

  testWidgets('Skip advances without posting but still records the screen',
      (tester) async {
    final sink = FakeOnboardingSink();
    await _boot(tester, _app(sink, resumeScreen: 2, profile: _profile));

    expect(find.text('Where do you cook?'), findsOneWidget);
    await _tap(tester, 'Skip');

    expect(find.text('About you'), findsOneWidget);
    expect(sink.saves, isEmpty);
    expect(sink.reached, [2]);
  });

  testWidgets('a failed save keeps the user on the screen and says so',
      (tester) async {
    final sink = FakeOnboardingSink()..fail = true;
    await _boot(tester, _app(sink, resumeScreen: 2, profile: _profile));

    await _tap(tester, 'Continue');

    expect(find.text('Where do you cook?'), findsOneWidget);
    expect(
      find.text("Couldn't save this step. Please try again."),
      findsOneWidget,
    );
    expect(_ctaDisabled(tester), isFalse);
  });

  testWidgets('resume opens on the screen the mapping names', (tester) async {
    await _boot(tester, _app(FakeOnboardingSink(), resumeScreen: 5));
    expect(find.text('Your cooking habits'), findsOneWidget);
    // Back walks the screens, not the server steps.
    await _tap(tester, 'Skip');
    expect(find.text('Your daily target'), findsOneWidget);
  });

  testWidgets('About you holds Continue on an out-of-range metric',
      (tester) async {
    final sink = FakeOnboardingSink();
    await _boot(tester, _app(sink, resumeScreen: 3, profile: _profile));
    expect(_ctaDisabled(tester), isFalse);

    // 5 kg is below the schema's floor: the step cannot be stored at all.
    await tester.enterText(find.byType(TextField).first, '5');
    await _frames(tester);
    expect(find.text('Weight must be at least 30 kg.'), findsOneWidget);
    expect(_ctaDisabled(tester), isTrue);

    // Cleared is NOT an error — the metrics are optional by design.
    await tester.enterText(find.byType(TextField).first, '');
    await _frames(tester);
    expect(find.text('Weight must be at least 30 kg.'), findsNothing);
    expect(_ctaDisabled(tester), isFalse);
  });

  testWidgets('every screen holds at 320pt with 1.3x text', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
        child: _app(FakeOnboardingSink(), profile: _profile),
      ),
    );
    await _frames(tester);

    // A RenderFlex overflow throws in a test, so walking the six screens IS
    // the assertion; the six titles prove the walk actually happened.
    for (var i = 0; i < 5; i++) {
      await _tap(tester, 'Continue');
    }
    expect(find.text('Your daily target'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('waits for the SESSION, and for a PROFILE that loads, before '
      'seeding — so a signed-in user keeps the answers they saved',
      (tester) async {
    // profileProvider answers `AsyncData(null)` the instant it is asked while
    // signed out, and Supabase restores the session a beat later; seeding on
    // that answer gives a signed-in user the device's guesses.
    const saved = ProfileRow({
      'onboardingStep': 1,
      'countryOfOrigin': 'Japan',
      'countryOfResidence': 'Japan',
      'preferredLocale': 'vi',
    });
    final sessions = StreamController<Session?>();
    addTearDown(sessions.close);
    final sink = FakeOnboardingSink();

    await _boot(
      tester,
      // The first signed-in fetch FAILS — neither loading nor loaded, so a
      // `!isLoading` hold let it through and seeded from the device.
      _app(sink, profile: saved, sessions: sessions.stream, profileFailures: 1),
    );
    // Nothing is drawn yet: there is no answer to seed from.
    expect(find.text('Choose your language'), findsNothing);
    expect(find.text('About you'), findsNothing);

    sessions.add(testSession());
    await _frames(tester);

    // Still nothing — and the wizard says so, with the one move that helps.
    expect(find.text('Choose your language'), findsNothing);
    expect(find.text('About you'), findsNothing);
    expect(
      find.text("Couldn't save this step. Please try again."),
      findsOneWidget,
    );
    await _tap(tester, 'Try again');

    // Server step 1 answered ⇒ the first screen of step 2.
    expect(find.text('About you'), findsOneWidget);

    // Let the toast finish leaving — it is pinned over the header chevron.
    await tester.pump(const Duration(seconds: 3));
    await _frames(tester);

    await tester.tap(find.byIcon(LucideIcons.chevronLeft300));
    await _frames(tester);
    expect(find.text('Where do you cook?'), findsOneWidget);
    expect(
      find.descendant(
        of: find.ancestor(
          of: find.text('Japan'),
          matching: find.byType(ListRow),
        ),
        matching: find.byIcon(LucideIcons.check300),
      ),
      findsOneWidget,
      reason: 'the saved country is the pick, not the phone region',
    );

    await _tap(tester, 'Continue');
    expect(sink.saves.single.data, {
      'countryOfOrigin': 'Japan',
      'countryOfResidence': 'Japan',
      'preferredLocale': 'vi',
    });
  });

  testWidgets('walking back through the screens keeps every answer',
      (tester) async {
    // The scaffold is keyed by screen, so each one is rebuilt from scratch on
    // the way back; only the wizard's single answers object carries the state.
    tester.view.physicalSize = const Size(390, 1400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final sink = FakeOnboardingSink();
    await tester.pumpWidget(_app(sink, profile: _profile));
    await _frames(tester);

    await _tap(tester, 'Continue'); // 1 → 2
    await _tap(tester, 'Australia'); // a country that is not the seed's
    await _tap(tester, 'Continue'); // 2 → 3
    await tester.enterText(find.byType(TextField).first, '72');
    await _frames(tester);
    await _tap(tester, 'Continue'); // 3 → 4
    await _tap(tester, 'Bulking');
    await _tap(tester, 'Continue'); // 4 → 5
    await _tap(tester, 'Continue'); // 5 → 6
    expect(find.text('Your daily target'), findsOneWidget);
    await _tap(tester, 'Higher carb');

    Future<void> back() async {
      await tester.tap(find.byIcon(LucideIcons.chevronLeft300));
      await _frames(tester);
    }

    await back(); // 6 → 5
    expect(find.text('Your cooking habits'), findsOneWidget);
    await back(); // 5 → 4
    expect(_selected(tester, 'Bulking'), isTrue);
    await back(); // 4 → 3
    expect(find.text('72'), findsOneWidget, reason: 'the weight survived');
    await back(); // 3 → 2
    expect(_selected(tester, 'Australia'), isTrue);

    // And forward again: what finally posts is what was entered, not the seed.
    for (var i = 0; i < 4; i++) {
      await _tap(tester, 'Continue');
    }
    await _tap(tester, 'Save my plan');
    final step2 = sink.saves.lastWhere((s) => s.step == 2).data;
    expect(step2['weightKg'], 72.0);
    expect(step2['goal'], 'bulking');
    expect(step2['carbSplit'], 'higher_carb');
    expect(sink.saves.firstWhere((s) => s.step == 1).data['countryOfOrigin'],
        'Australia');
  });

  testWidgets('screen 1 offers no Skip, and back there closes the wizard '
      'rather than popping a screen', (tester) async {
    var closed = 0;
    await _boot(tester, _app(FakeOnboardingSink(), onClose: () => closed++));

    expect(find.text('Choose your language'), findsOneWidget);
    expect(find.text('Skip'), findsNothing, reason: 'a language has to be chosen');

    await tester.tap(
      find.byIcon(LucideIcons.chevronLeft300),
      warnIfMissed: false,
    );
    await _frames(tester);
    expect(closed, 1);
  });
}
