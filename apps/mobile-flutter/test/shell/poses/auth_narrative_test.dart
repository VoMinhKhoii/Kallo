import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/auth/widgets/auth_page.dart';
import 'package:kallo_mobile/features/auth/widgets/email_auth_form.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/auth_options.dart';
import 'package:kallo_mobile/features/onboarding/widgets/backdrop/step_backdrop.dart';
import 'package:kallo_mobile/features/onboarding/widgets/start/start_hero.dart';
import 'package:kallo_mobile/features/onboarding/widgets/start/start_preview_box.dart';
import 'package:kallo_mobile/shared/widgets/brand/kallo_wordmark.dart';
import 'package:kallo_mobile/features/onboarding/widgets/onboarding_step_content.dart';
import 'package:kallo_mobile/features/onboarding/widgets/onboarding_step_scaffold.dart';
import 'package:kallo_mobile/features/onboarding/screens/start_screen.dart';
import 'package:kallo_mobile/features/onboarding/screens/step_about_you.dart';
import 'package:kallo_mobile/features/paywall/screens/paywall_purchase_face.dart';
import 'package:kallo_mobile/features/paywall/widgets/pitch/paywall_guide.dart';
import 'package:kallo_mobile/features/paywall/widgets/pitch/plan_comparison.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/paywall_buy_band.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/plan_toggle.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';
import 'harness/pose_harness.dart';
import 'harness/poses.dart';

void main() {
  setUpAll(initializePoseHarness);

  testWidgets('start keeps its route element on a fold', (tester) async {
    final dispose = await bootPose(
      tester,
      innerLandscape,
      '/start',
      signedIn: false,
    );
    final element = tester.element(find.byType(StartScreen));
    for (final pose in [outerPortrait, innerLandscape]) {
      resize(tester, pose);
      await settlePose(tester);
      expect(tester.element(find.byType(StartScreen)), same(element));
      expect(find.byKey(StartScreen.previewKey), findsOneWidget);
      expect(tester.takeException(), isNull);
    }
    await dispose();
  });

  testWidgets('metrics fields retain their controllers on a fold', (
    tester,
  ) async {
    final dispose = await bootPose(
      tester,
      innerLandscape,
      '/onboarding',
      signedIn: false,
    );
    await tester.tap(find.text('Continue'));
    await settlePose(tester);
    await tester.tap(find.text('Skip'));
    await settlePose(tester);
    final state = tester.state(find.byType(StepAboutYou));
    final field = find.byType(EditableText).first;
    await tester.enterText(field, '28');
    for (final pose in [outerLandscape, innerLandscape]) {
      resize(tester, pose);
      await settlePose(tester);
      expect(tester.state(find.byType(StepAboutYou)), same(state));
      expect(tester.widget<EditableText>(field).controller.text, '28');
      expect(tester.takeException(), isNull);
    }
    await dispose();
  });

  testWidgets('email text, selection and focus survive folding', (
    tester,
  ) async {
    final dispose = await bootPose(
      tester,
      innerLandscape,
      '/sign-in/email',
      signedIn: false,
    );
    final form = tester.state(find.byType(EmailAuthForm));
    final field = find.byType(EditableText).first;
    await tester.enterText(field, 'duo@example.com');
    final before = tester.widget<EditableText>(field);
    before.controller.selection = const TextSelection.collapsed(offset: 4);
    expect(before.focusNode.hasFocus, isTrue);
    for (final pose in [outerPortrait, innerLandscape]) {
      resize(tester, pose);
      await settlePose(tester);
      expect(tester.state(find.byType(EmailAuthForm)), same(form));
      final after = tester.widget<EditableText>(field);
      expect(after.controller.text, 'duo@example.com');
      expect(after.controller.selection.baseOffset, 4);
      expect(after.focusNode.hasFocus, isTrue);
      expect(tester.takeException(), isNull);
    }
    await dispose();
  });

  testWidgets(
    'sign-in task fits the near pane and retains its controller host',
    (tester) async {
      final dispose = await bootPose(
        tester,
        innerLandscape,
        '/sign-in',
        signedIn: false,
      );
      final state = tester.state(find.byType(AuthPage));
      final rect = tester.getRect(find.byType(AuthOptions));
      expect(rect.left, 519.5);
      expect(rect.width, 323.5);
      debugPrint('sign-in task: $rect');
      for (final pose in [outerPortrait, innerLandscape]) {
        resize(tester, pose);
        await settlePose(tester);
        expect(tester.state(find.byType(AuthPage)), same(state));
      }
      await dispose();
    },
  );

  testWidgets('country scroll and wizard step survive folding', (tester) async {
    final dispose = await bootPose(
      tester,
      innerLandscape,
      '/onboarding',
      signedIn: false,
    );
    await tester.tap(find.text('Continue'));
    await settlePose(tester);
    final scaffold = tester.state(find.byType(OnboardingStepScaffold));
    final scroll =
        find
            .descendant(
              of: find.byType(OnboardingStepContent),
              matching: find.byType(Scrollable),
            )
            .first;
    final scrollState = tester.state<ScrollableState>(scroll);
    final position = scrollState.position;
    position.jumpTo(160);
    await tester.pump();
    final button = tester.getRect(find.byType(KalloButton));
    expect(button.left, 519.5);
    expect(button.width, 323.5);
    debugPrint('onboarding CTA: $button; country offset: ${position.pixels}');
    for (final pose in [outerPortrait, innerLandscape]) {
      resize(tester, pose);
      await settlePose(tester);
      expect(tester.state(find.byType(OnboardingStepScaffold)), same(scaffold));
      expect(
        tester
            .widget<OnboardingStepScaffold>(find.byType(OnboardingStepScaffold))
            .screen,
        2,
      );
      expect(tester.state<ScrollableState>(scroll), same(scrollState));
      expect(scrollState.position.pixels, 160);
      expect(tester.takeException(), isNull);
    }
    await dispose();
  });

  testWidgets('paywall retains selection and pitch scroll through folding', (
    tester,
  ) async {
    final dispose = await bootPose(tester, innerLandscape, '/paywall');
    final state = tester.state(find.byType(PaywallPurchaseFace));
    final scroll =
        find
            .descendant(
              of: find.byType(PaywallPurchaseFace),
              matching: find.byType(Scrollable),
            )
            .first;
    final scrollState = tester.state<ScrollableState>(scroll);
    final toggle = tester.widget<PlanToggle>(find.byType(PlanToggle));
    toggle.onChanged?.call(!toggle.yearly);
    await settlePose(tester);
    final yearly = tester.widget<PlanToggle>(find.byType(PlanToggle)).yearly;
    expect(
      tester.getRect(find.byType(PlanComparison)).right,
      lessThanOrEqualTo(455.5),
    );
    expect(
      tester.getRect(find.byType(PlanToggle)).left,
      greaterThanOrEqualTo(495.5),
    );
    for (final pose in [outerPortrait, innerLandscape]) {
      resize(tester, pose);
      await settlePose(tester);
      expect(tester.state(find.byType(PaywallPurchaseFace)), same(state));
      expect(tester.state<ScrollableState>(scroll), same(scrollState));
      expect(tester.widget<PlanToggle>(find.byType(PlanToggle)).yearly, yearly);
      expect(tester.takeException(), isNull);
    }
    await dispose();
  });

  // Beside the fold the signed-out flow keeps one thing on the far side from
  // its first screen to its last: the start preview. Only the near pane
  // changes, so nothing is left hanging in a corner beside an empty half.
  group('beside the fold', () {
    double middle(WidgetTester tester, Finder finder) =>
        tester.getRect(finder).center.dy;

    for (final route in [
      '/start',
      '/sign-in',
      '/sign-in/email',
      '/onboarding',
    ]) {
      testWidgets('$route keeps the start preview on the far side', (
        tester,
      ) async {
        final dispose = await bootPose(
          tester,
          innerLandscape,
          route,
          signedIn: false,
        );
        final hero = tester.getRect(find.byType(StartHero));
        expect(hero.left, 0);
        expect(hero.right, lessThanOrEqualTo(455.5));
        // The preview carries the wordmark, so the near pane does not say it
        // again.
        expect(find.byType(KalloWordmark), findsOneWidget);
        resize(tester, outerPortrait);
        await settlePose(tester);
        expect(find.byType(StartHero), findsNothing);
        expect(find.byType(KalloWordmark), findsOneWidget);
        expect(tester.takeException(), isNull);
        await dispose();
      });
    }

    testWidgets('the preview stands still while a route is pushed over it', (
      tester,
    ) async {
      final dispose = await bootPose(
        tester,
        innerLandscape,
        '/start',
        signedIn: false,
      );
      final preview = find.byType(StartPreviewBox);
      final before = tester.getRect(preview);
      await tester.tap(find.text('I already have an account'));
      // Mid-push both routes are on screen, and each would paint its own
      // preview, one sliding over the other. In flight there is one, and it
      // has not moved with the incoming page.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 150));
      expect(tester.takeException(), isNull);
      expect(preview, findsOneWidget);
      expect(tester.getRect(preview), before);
      await settlePose(tester);
      expect(find.byType(AuthOptions), findsOneWidget);
      expect(tester.getRect(preview), before);
      expect(tester.takeException(), isNull);
      await dispose();
    });

    testWidgets('save-plan keeps its column through a fold', (tester) async {
      final dispose = await bootPose(
        tester,
        innerLandscape,
        '/save-plan',
        signedIn: false,
      );
      expect(find.byType(StartHero), findsOneWidget);
      expect(find.byType(KalloWordmark), findsOneWidget);
      final state = tester.state(find.byType(AuthPage));
      for (final pose in [outerPortrait, innerLandscape]) {
        resize(tester, pose);
        await settlePose(tester);
        expect(tester.state(find.byType(AuthPage)), same(state));
        expect(tester.takeException(), isNull);
      }
      await dispose();
    });

    // The strips that continue the backdrop (the wizard's button band, the
    // save-plan options) paint their own copy of it. A copy that is not
    // exactly over the page's shows as a seam through the colour.
    for (final route in ['/onboarding', '/save-plan']) {
      testWidgets('$route: the backdrop strip lies over the backdrop', (
        tester,
      ) async {
        final dispose = await bootPose(
          tester,
          innerLandscape,
          route,
          signedIn: false,
        );
        for (final pose in [innerLandscape, outerPortrait, outerLandscape]) {
          resize(tester, pose);
          await settlePose(tester);
          final copies = find.byType(StepBackdrop);
          expect(copies, findsNWidgets(2), reason: pose.name);
          final window = Offset.zero & pose.size;
          for (var i = 0; i < 2; i++) {
            expect(
              tester.getRect(copies.at(i)),
              rectMoreOrLessEquals(window, epsilon: .01),
              reason: pose.name,
            );
          }
        }
        await dispose();
      });
    }

    testWidgets('sign-in: the options sit at mid height', (tester) async {
      final dispose = await bootPose(
        tester,
        innerLandscape,
        '/sign-in',
        signedIn: false,
      );
      final options = tester.getRect(find.byType(AuthOptions));
      expect(options.left, greaterThanOrEqualTo(495.5));
      expect(options.center.dy, closeTo(innerLandscape.size.height / 2, 40));
      await dispose();
    });

    testWidgets('start: the decision sits at mid height', (tester) async {
      final dispose = await bootPose(
        tester,
        innerLandscape,
        '/start',
        signedIn: false,
      );
      final button = tester.getRect(find.text('Get started'));
      expect(button.center.dy, closeTo(innerLandscape.size.height / 2, 60));
      await dispose();
    });

    testWidgets('onboarding: the whole step is the near pane', (tester) async {
      final dispose = await bootPose(
        tester,
        innerLandscape,
        '/onboarding',
        signedIn: false,
      );
      for (final text in ['Choose your language', 'Continue']) {
        expect(
          tester.getRect(find.text(text)).left,
          greaterThanOrEqualTo(495.5),
        );
      }
      await dispose();
    });

    testWidgets('paywall: the table and the decision, title included', (
      tester,
    ) async {
      final dispose = await bootPose(tester, innerLandscape, '/paywall');
      final band = find.byType(PaywallBuyBand);
      final guideInBand = find.descendant(
        of: band,
        matching: find.byType(PaywallGuide),
      );
      expect(guideInBand, findsOneWidget);
      expect(
        middle(tester, find.byType(PlanComparison)),
        closeTo(middle(tester, band), 32),
      );
      resize(tester, outerPortrait);
      await settlePose(tester);
      expect(guideInBand, findsNothing);
      expect(find.byType(PaywallGuide), findsOneWidget);
      await dispose();
    });
  });
}
