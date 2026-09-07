import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:kallo_mobile/features/onboarding/data/onboarding_draft.dart';
import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_draft_providers.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/onboarding/screens/step_about_you.dart';
import 'package:kallo_mobile/features/onboarding/screens/step_language.dart';
import 'package:kallo_mobile/features/onboarding/screens/step_origin.dart';
import 'package:kallo_mobile/features/onboarding/widgets/onboarding_step_header.dart';
import 'package:kallo_mobile/features/onboarding/widgets/onboarding_step_transition.dart';
import 'package:kallo_mobile/features/onboarding/widgets/onboarding_wizard.dart';
import 'package:kallo_mobile/shared/widgets/mascot/bun_mascot.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';

import 'onboarding_test_support.dart';

/// The step transition's contract: ONE persistent tree wearing six contents.
///
/// The header, the bun and the CTA are the same widgets on every screen — they
/// must not move, and the bun must not lose its State (its blink and breath run
/// off a Ticker that a rebuild would restart). Only the region between them
/// travels, and it travels the way you walked.

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

Widget _app(
  FakeOnboardingSink sink, {
  int resumeScreen = 1,
  bool reduceMotion = false,
}) => ProviderScope(
  overrides: [
    onboardingSinkProvider.overrideWithValue(sink),
    onboardingResumeScreenProvider.overrideWithValue(resumeScreen),
    profileProvider.overrideWith((ref) async => _profile),
    onboardingDraftStoreProvider.overrideWithValue(
      OnboardingDraftStore(storage: InMemoryKeyValueStore()),
    ),
  ],
  child: localizedHome(
    Builder(
      builder: (inner) => MediaQuery(
        data: MediaQuery.of(inner).copyWith(disableAnimations: reduceMotion),
        child: Scaffold(
          backgroundColor: kPage,
          body: SafeArea(child: OnboardingWizard(onComplete: () {}, onClose: null)),
        ),
      ),
    ),
  ),
);

/// Never `pumpAndSettle`: the bun's breath runs on an endless Ticker.
Future<void> _frames(WidgetTester tester, {int count = 8}) async {
  for (var i = 0; i < count; i++) {
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

State _bunState(WidgetTester tester) =>
    tester.state(find.byType(BunMascot));

Rect _rect(WidgetTester tester, Finder finder) => tester.getRect(finder);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(initOnboardingTest);

  testWidgets('the bun survives the step change as the SAME State object',
      (tester) async {
    await _boot(tester, _app(FakeOnboardingSink()));

    final before = _bunState(tester);
    await tester.tap(find.text('Continue'));
    await _frames(tester);

    expect(find.text('Where do you cook?'), findsOneWidget);
    // Not `equals` on a value — the identical object, which is what keeps the
    // blink schedule and the breath phase running through the transition.
    expect(identical(_bunState(tester), before), isTrue);
  });

  testWidgets('mid-transition the chrome holds still while the two contents '
      'sit side by side', (tester) async {
    await _boot(tester, _app(FakeOnboardingSink()));

    final header = _rect(tester, find.byType(OnboardingStepHeader));
    final bun = _rect(tester, find.byType(BunMascot));
    final cta = _rect(tester, find.byType(KalloButton));

    await tester.tap(find.text('Continue'));
    await tester.pump(); // the frame the switcher starts on
    await tester.pump(const Duration(milliseconds: 140)); // half of `page`

    // Both contents are mounted and neither is where the other is.
    expect(find.byType(StepLanguage), findsOneWidget);
    expect(find.byType(StepOrigin), findsOneWidget);
    final leaving = _rect(tester, find.byType(StepLanguage));
    final arriving = _rect(tester, find.byType(StepOrigin));
    expect(leaving.left, lessThan(arriving.left));

    // …and the chrome around them has not moved a pixel.
    expect(_rect(tester, find.byType(OnboardingStepHeader)), header);
    expect(_rect(tester, find.byType(BunMascot)), bun);
    expect(_rect(tester, find.byType(KalloButton)), cta);
  });

  testWidgets('Back mirrors the sweep — the incoming content enters from the '
      'left', (tester) async {
    await _boot(tester, _app(FakeOnboardingSink(), resumeScreen: 2));

    await tester.tap(find.byIcon(LucideIcons.chevronLeft300));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 140));

    final region = _rect(tester, find.byType(OnboardingStepTransition));
    final leaving = _rect(tester, find.byType(StepOrigin));
    final arriving = _rect(tester, find.byType(StepLanguage));
    // The mirror of the forward case: the arrival comes from the LEFT of
    // where it will land, and the departure leaves to the right of it.
    expect(arriving.left, lessThan(region.left));
    expect(leaving.left, greaterThan(arriving.left));
  });

  testWidgets('reduced motion cross-fades in place — no translation at all',
      (tester) async {
    await _boot(tester, _app(FakeOnboardingSink(), reduceMotion: true));

    final content = _rect(tester, find.byType(StepLanguage));
    await tester.tap(find.text('Continue'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100)); // half of `quick`

    // Both are exactly where the resting content was: nothing translated,
    // and only the opacity separates them.
    // Compared by ORIGIN: the two screens are different heights inside their
    // scroll views, but neither has been shifted off the region's corner.
    expect(_rect(tester, find.byType(StepLanguage)).topLeft, content.topLeft);
    expect(_rect(tester, find.byType(StepOrigin)).topLeft, content.topLeft);
    final fades = tester
        .widgetList<FadeTransition>(find.byType(FadeTransition))
        .map((f) => f.opacity.value)
        .toList();
    expect(fades.any((o) => o > 0 && o < 1), isTrue);
  });

  testWidgets('the CTA cross-fades its label on the way into screen 6',
      (tester) async {
    await _boot(tester, _app(FakeOnboardingSink(), resumeScreen: 5));

    expect(find.text('Continue'), findsOneWidget);
    await tester.tap(find.text('Continue'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100)); // half of `quick`

    // Both labels on screen at once, inside ONE button: the label dissolves,
    // the black pill it sits in never leaves.
    expect(find.byType(KalloButton), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);
    expect(find.text('Save my plan'), findsOneWidget);

    await _frames(tester);
    expect(find.text('Continue'), findsNothing);
    expect(find.text('Save my plan'), findsOneWidget);
  });

  testWidgets('the bubble MORPHS its height rather than jumping to it',
      (tester) async {
    // 320pt is where the guide lines wrap far enough for the BUBBLE, not the
    // bun, to set the band's height: screen 2's line runs to 112pt there and
    // screen 3's back to the bun's own 77.
    tester.view.physicalSize = const Size(320, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_app(FakeOnboardingSink(), resumeScreen: 2));
    // Long enough for the typewriter to finish the line: the bubble grows a
    // grapheme at a time, so a half-typed line is not its resting height.
    await _frames(tester, count: 60);

    // The BOX around the mascot, not the mascot: the child is re-laid out at
    // its new height on the first frame — the box is what has to travel.
    final band = find.ancestor(
      of: find.byType(BunMascot),
      matching: find.byType(AnimatedSize),
    );
    expect(band, findsOneWidget);
    final before = tester.getSize(band).height;

    await tester.tap(find.text('Continue'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 40)); // a fifth of `quick`
    final mid = tester.getSize(band).height;

    await _frames(tester, count: 60);
    final after = tester.getSize(band).height;

    expect(after, lessThan(before), reason: 'the two lines are the same size');
    // Strictly between: unanimated, the band would already be at `after` on
    // the first frame and shove the title up with it.
    expect(mid, greaterThan(after));
    expect(mid, lessThan(before));
  });

  testWidgets('each screen gets its own scroll position, starting at the top',
      (tester) async {
    await _boot(tester, _app(FakeOnboardingSink(), resumeScreen: 2));

    // `primary: false` and no controller of its own, so the position lives on
    // the Scrollable the region built.
    double offset() => tester
        .state<ScrollableState>(
          find
              .descendant(
                of: find.byType(SingleChildScrollView),
                matching: find.byType(Scrollable),
              )
              .first,
        )
        .position
        .pixels;

    await tester.dragFrom(
      tester.getCenter(find.byType(OnboardingStepTransition)),
      const Offset(0, -200),
    );
    await _frames(tester);
    expect(offset(), greaterThan(0));

    await tester.tap(find.text('Continue'));
    await _frames(tester);
    expect(find.byType(StepAboutYou), findsOneWidget);
    // A fresh region, so a fresh Scrollable: screen 3 opens at its title, not
    // 200pt down where screen 2 was left.
    expect(offset(), 0);
  });
}
