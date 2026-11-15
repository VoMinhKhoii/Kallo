import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/auth/widgets/auth_page.dart';
import 'package:kallo_mobile/features/auth/widgets/email_auth_form.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/auth_options.dart';
import 'package:kallo_mobile/features/onboarding/widgets/onboarding_step_content.dart';
import 'package:kallo_mobile/features/onboarding/widgets/onboarding_step_scaffold.dart';
import 'package:kallo_mobile/features/onboarding/screens/start_screen.dart';
import 'package:kallo_mobile/features/onboarding/screens/step_about_you.dart';
import 'package:kallo_mobile/features/paywall/screens/paywall_purchase_face.dart';
import 'package:kallo_mobile/features/paywall/widgets/pitch/plan_comparison.dart';
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
}
