import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/auth/widgets/auth_page.dart';
import 'package:kallo_mobile/features/auth/widgets/email_auth_form.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/auth_brand_hero.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/auth_legal_links.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/auth_options.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/google_button.dart';
import 'package:kallo_mobile/features/auth/widgets/auth_submit_button.dart';
import 'package:kallo_mobile/features/auth/widgets/auth_text_field.dart';
import 'package:kallo_mobile/features/onboarding/widgets/backdrop/step_backdrop.dart';
import 'package:kallo_mobile/features/onboarding/widgets/start/start_device_preview.dart';
import 'package:kallo_mobile/features/onboarding/widgets/start/start_hero.dart';
import 'package:kallo_mobile/features/onboarding/widgets/start/start_preview_box.dart';
import 'package:kallo_mobile/shared/widgets/brand/kallo_wordmark.dart';
import 'package:kallo_mobile/features/onboarding/widgets/onboarding_step_content.dart';
import 'package:kallo_mobile/features/onboarding/widgets/onboarding_step_scaffold.dart';
import 'package:kallo_mobile/features/onboarding/screens/start_screen.dart';
import 'package:kallo_mobile/features/onboarding/screens/step_about_you.dart';
import 'package:kallo_mobile/features/paywall/screens/paywall_purchase_face.dart';
import 'package:kallo_mobile/features/paywall/widgets/pitch/plan_comparison.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/paywall_buy_band.dart';
import 'package:kallo_mobile/features/paywall/widgets/paywall_header.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/plan_cta.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/plan_toggle.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';
import 'package:kallo_mobile/shell/window/keep_clear_zones.dart';
import 'package:kallo_mobile/shell/window/window_layout.dart';
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
      // The near pane runs from the fold to the window's edge on this
      // column-free page: 495.5 to 951, less its 24pt margins.
      expect(rect.left, 519.5);
      expect(rect.width, 407.5);
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
    expect(button.width, 407.5);
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
    // Beside the fold the whole phone column is the near pane.
    for (final piece in [PlanComparison, PlanToggle, PaywallBuyBand]) {
      expect(
        tester.getRect(find.byType(piece)).left,
        greaterThanOrEqualTo(495.5),
      );
    }
    for (final pose in [outerPortrait, outerLandscape, innerLandscape]) {
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
    testWidgets('column on the left: the dishes stop short of the fold', (
      tester,
    ) async {
      final dispose = await bootPose(
        tester,
        innerLandscapeLeft,
        '/start',
        signedIn: false,
      );
      final hero = tester.getRect(find.byType(StartHero));
      final card = tester.getRect(find.byKey(StartDevicePreview.previewKey));
      final scale = card.height / StartDevicePreview.cardHeight;
      // The far pane is the right one here, so the phở (200pt left of the
      // middle at scale 1) is the dish facing the fold.
      expect(hero.left, greaterThanOrEqualTo(495.5));
      expect(card.center.dx - 200 * scale, greaterThanOrEqualTo(hero.left));
      expect(tester.takeException(), isNull);
      await dispose();
    });

    for (final route in [
      '/start',
      '/sign-in',
      '/sign-in/email',
      '/onboarding',
      '/save-plan',
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
        // Nothing stands over or under the device here, so it is shown whole
        // and centred on the line the near column centres on: the middle of
        // the safe area, whose top is at least 12.
        final card = tester.getRect(find.byKey(StartDevicePreview.previewKey));
        expect(
          card.center.dy,
          moreOrLessEquals(
            (12 + innerLandscape.size.height - innerLandscape.padding.bottom) /
                2,
            epsilon: .5,
          ),
        );
        // The dishes over the card (40pt at scale 1) and under it (56pt) stay
        // on the display, and the ones beside it (190pt from the middle)
        // stop short of the fold.
        final scale = card.height / StartDevicePreview.cardHeight;
        expect(card.top, greaterThan(40 * scale));
        expect(card.bottom, lessThan(innerLandscape.size.height - 56 * scale));
        expect(card.center.dx + 190 * scale, lessThanOrEqualTo(455.5));
        expect(scale, greaterThan(1.15));
        // The preview is the device alone, the same on every screen, so the
        // name is said once, in the screen's own column.
        expect(
          find.descendant(
            of: find.byType(StartHero),
            matching: find.byType(KalloWordmark),
          ),
          findsNothing,
        );
        expect(find.byType(KalloWordmark), findsOneWidget);
        expect(
          tester.getRect(find.byType(KalloWordmark)).left,
          greaterThanOrEqualTo(495.5),
        );
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

    testWidgets('sign-in: the brand block stands over the options at mid '
        'height', (tester) async {
      final dispose = await bootPose(
        tester,
        innerLandscape,
        '/sign-in',
        signedIn: false,
      );
      final brand = tester.getRect(find.byType(AuthBrandHero));
      final options = tester.getRect(find.byType(AuthOptions));
      expect(brand.left, greaterThanOrEqualTo(495.5));
      expect(options.top - brand.bottom, 32);
      final group = brand.expandToInclude(options);
      expect(group.center.dy, closeTo(innerLandscape.size.height / 2, 40));
      await dispose();
    });

    testWidgets('start: the wordmark heads the decision at mid height', (
      tester,
    ) async {
      final dispose = await bootPose(
        tester,
        innerLandscape,
        '/start',
        signedIn: false,
      );
      final mark = tester.getRect(find.byType(KalloWordmark));
      final title = tester.getRect(find.text('Log meals the way you say them'));
      final button = tester.getRect(find.text('Get started'));
      expect(mark.left, greaterThanOrEqualTo(495.5));
      expect(title.top - mark.bottom, 16);
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

    testWidgets('paywall: the start preview beside the phone column', (
      tester,
    ) async {
      final dispose = await bootPose(tester, innerLandscape, '/paywall');
      final hero = tester.getRect(find.byType(StartHero));
      expect(hero.left, 0);
      expect(hero.right, lessThanOrEqualTo(455.5));
      expect(
        tester.getRect(find.byType(KalloWordmark)).left,
        greaterThanOrEqualTo(495.5),
      );
      final table = tester.getRect(find.byType(PlanComparison));
      expect(table.left, greaterThanOrEqualTo(495.5));
      // The near pane is wide enough here for the table's reading size, and
      // the card's foot runs a point under the band's top padding; the last
      // row stands clear above the band.
      expect(
        tester.getRect(find.text('Groups & friends')).bottom,
        lessThanOrEqualTo(tester.getRect(find.byType(PaywallBuyBand)).top),
      );
      expectOneColumnEdge(tester);
      await dispose();
    });
  });

  // Turned sideways the closed display is too short for the whole form, and
  // the last way in used to start below the edge.
  testWidgets('email sign-in shows Google on a short window without '
      'scrolling', (tester) async {
    final dispose = await bootPose(
      tester,
      outerLandscape,
      '/sign-in/email',
      signedIn: false,
    );
    final google = tester.getRect(find.byType(GoogleButton));
    expectOnPage(outerLandscape, google);
    expect(find.text('Sign in to continue tracking your meals.'), findsNothing);
    await dispose();
  });

  // The suite runs as Android and in English: sign-in has no Apple button
  // there, and the terms sentence is one line. On an iPhone in Vietnamese
  // the stack is a button and a line taller, and a window on its side has
  // no height to spare for either.
  for (final route in ['/sign-in', '/sign-in/email']) {
    for (final pose in [outerLandscape, phoneLandscape]) {
      testWidgets('$route in Vietnamese on an iPhone fits ${pose.name}', (
        tester,
      ) async {
        debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
        try {
          final dispose = await bootPose(
            tester,
            pose,
            route,
            signedIn: false,
            locale: 'vi',
          );
          expect(find.text('Tiếp tục với Apple'), findsOneWidget);
          expect(tester.takeException(), isNull);
          await dispose();
        } finally {
          debugDefaultTargetPlatformOverride = null;
        }
      });
    }
  }

  // Held tall, the form is centred, and the fold line at half the window's
  // height falls in the gap between the email field and its button.
  testWidgets('email sign-in held tall keeps the fold off the controls', (
    tester,
  ) async {
    final dispose = await bootPose(
      tester,
      innerPortrait,
      '/sign-in/email',
      signedIn: false,
    );
    final fold = innerPortrait.size.height / 2;
    final field = tester.getRect(find.byType(AuthTextField));
    final send = tester.getRect(find.byType(AuthSubmitButton));
    expect(field.bottom, lessThan(fold));
    expect(send.top, greaterThan(fold));
    final title = tester.getRect(find.text('Welcome back'));
    final legal = tester.getRect(find.byType(AuthLegalLinks));
    final safeMiddle =
        (innerPortrait.padding.top +
            44 +
            innerPortrait.size.height -
            innerPortrait.padding.bottom) /
        2;
    expect((title.top + legal.bottom) / 2, closeTo(safeMiddle, 24 + 1));
    await dispose();
  });

  // Wide and short (the closed display on its side): stacked, the band
  // covered the whole table. Side by side, both are in view at once.
  for (final pose in [outerLandscape, phoneLandscape]) {
    testWidgets('paywall at ${pose.name}: the table beside the decision', (
      tester,
    ) async {
      final dispose = await bootPose(tester, pose, '/paywall');
      final table = tester.getRect(find.byType(PlanComparison));
      final cta = tester.getRect(find.byType(PlanCta));
      for (final rect in [table, cta]) {
        expectOnPage(pose, rect);
      }
      expect(table.overlaps(cta), isFalse);
      for (final scroll in find.byType(Scrollable).evaluate()) {
        final state = (scroll as StatefulElement).state as ScrollableState;
        expect(state.position.maxScrollExtent, 0);
      }
      final title = find.descendant(
        of: find.byType(PaywallBuyBand),
        matching: find.text('Choose your plan'),
      );
      // One line of the 28pt title, not two.
      expect(tester.getRect(title).height, lessThan(40));
      // Each half of the toggle leaves its label 10pt of air on both sides.
      final toggle = tester.getRect(find.byType(PlanToggle));
      final half = (toggle.width - 8) / 2;
      final monthly = tester.getRect(find.text('Monthly plan'));
      expect(monthly.left - (toggle.left + 4), greaterThanOrEqualTo(10));
      expect(toggle.left + 4 + half - monthly.right, greaterThanOrEqualTo(10));
      // The Free and Premium columns take what they hold, and the rest goes
      // to the labels: most of them stay on one line.
      for (final label in [
        'Macros tracking',
        'Scan nutrition labels',
        'Visual edit',
        'Micros (7 / 30 / 90d)',
        'Groups & friends',
      ]) {
        // One line is 18pt at 14pt type and 23 at 16; two are 36 or more.
        expect(tester.getRect(find.text(label)).height, lessThan(30));
      }
      // The close glyph heads the decision, clear of the table.
      expect(
        tester.getRect(find.byType(PaywallHeader)).left,
        greaterThanOrEqualTo(table.right),
      );
      await dispose();
    });
  }

  // Held upright the closed display is short: the table closes up so every
  // row is in view over the pinned band without a scroll.
  testWidgets('paywall on the closed display shows every row', (tester) async {
    final dispose = await bootPose(tester, outerPortrait, '/paywall');
    final last = tester.getRect(find.text('Groups & friends'));
    final cta = tester.getRect(find.byType(PlanCta));
    for (final rect in [last, cta]) {
      expectOnPage(outerPortrait, rect);
    }
    expect(last.overlaps(cta), isFalse);
    expect(
      tester.getRect(find.byType(PlanComparison)).bottom,
      lessThanOrEqualTo(tester.getRect(find.byType(PaywallBuyBand)).top),
    );
    expectOneColumnEdge(tester);
    await dispose();
  });
}

/// [rect] is in view on a page that leaves the control column empty: inside
/// the window less its top and bottom insets, and clear of the column's
/// keep-clear corners.
void expectOnPage(Pose pose, Rect rect) {
  final page = Rect.fromLTRB(
    0,
    pose.padding.top,
    pose.size.width,
    pose.size.height - pose.padding.bottom,
  );
  expect(page.contains(rect.topLeft), isTrue, reason: '$rect');
  expect(page.contains(rect.bottomRight), isTrue, reason: '$rect');
  for (final zone in WindowLayout.resolve(pose.size, pose.padding).keepClear) {
    expect(rect.overlaps(zone), isFalse, reason: '$rect in $zone');
  }
}

/// The table and the buy button share one left edge and one right edge; the
/// title starts on that left edge, and the close glyph's strokes, 6pt into
/// its box, start there too, as they do on a phone. These windows leave the
/// control column on the right empty, so beside its status items the title
/// wraps before it and the toggle narrows on both sides, centred on the
/// column.
void expectOneColumnEdge(WidgetTester tester) {
  final table = tester.getRect(find.byType(PlanComparison));
  final cta = tester.getRect(find.byType(PlanCta));
  expect(cta.left, moreOrLessEquals(table.left, epsilon: .01));
  expect(cta.right, moreOrLessEquals(table.right, epsilon: .01));
  expect(
    tester.getRect(find.text('Choose your plan')).left,
    moreOrLessEquals(table.left, epsilon: .01),
  );
  expect(
    tester.getRect(find.byType(PlanToggle)).center.dx,
    moreOrLessEquals(table.center.dx, epsilon: .01),
  );
  final glyph = tester.getRect(
    find.descendant(
      of: find.byType(PaywallHeader),
      matching: find.byType(RichText),
    ),
  );
  expect(glyph.left + 6, moreOrLessEquals(table.left, epsilon: .01));
}
