import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/auth/screens/email_auth_screen.dart';
import 'package:kallo_mobile/features/auth/screens/sign_in_screen.dart';
import 'package:kallo_mobile/features/auth/screens/sign_up_screen.dart';
import 'package:kallo_mobile/features/auth/widgets/email_auth_form.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/auth_options.dart';
import 'package:kallo_mobile/features/circle/screens/connect_screen.dart';
import 'package:kallo_mobile/features/onboarding/providers/first_run_finish.dart';
import 'package:kallo_mobile/features/onboarding/screens/onboarding_screen.dart';
import 'package:kallo_mobile/features/onboarding/widgets/backdrop/backdrop_slice.dart';
import 'package:kallo_mobile/features/onboarding/widgets/narrative/onboarding_answer.dart';
import 'package:kallo_mobile/features/onboarding/screens/save_plan_screen.dart';
import 'package:kallo_mobile/features/onboarding/screens/start_screen.dart';
import 'package:kallo_mobile/features/onboarding/screens/welcome_setup_screen.dart';
import 'package:kallo_mobile/features/paywall/screens/paywall_screen.dart';
import 'package:kallo_mobile/features/paywall/widgets/paywall_gutter.dart';
import 'package:kallo_mobile/features/paywall/widgets/paywall_split.dart';
import 'package:kallo_mobile/features/paywall/widgets/pitch/plan_comparison.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/plan_cta.dart';
import 'package:kallo_mobile/shared/widgets/panes/narrative_panes.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';
import 'package:kallo_mobile/shell/window/keep_clear_zones.dart';
import 'package:kallo_mobile/shell/window/window_layout.dart';

import 'harness/keep_clear_probe.dart';
import 'harness/pose_harness.dart';
import 'harness/poses.dart';

/// Every window with a control column, the column on either side.
const _columnPoses = [
  outerPortrait,
  outerLandscape,
  outerLandscapeLeft,
  innerLandscape,
  innerLandscapeLeft,
  splitLeft,
  splitRight,
  pipPinned,
];

/// A screen that leaves the control column empty, and the piece of it whose
/// box is the page's content column.
class _Case {
  const _Case(
    this.name,
    this.route,
    this.screen,
    this.column, {
    this.signedIn = false,
    this.splits = true,
    this.skips,
    this.overrides = const [],
  });

  final String name;
  final String route;
  final Type screen;
  final Rect Function(WidgetTester tester) column;
  final bool signedIn;

  /// False for a page that is one column in every window. Beside a fold it
  /// stays one column, centred on the window like any other.
  final bool splits;

  /// Onboarding: how many screens past the first ("Continue", then "Skip").
  final int? skips;
  final List<Override> overrides;
}

Rect _of(WidgetTester tester, Finder finder) => tester.getRect(finder.first);

Rect _button(WidgetTester tester) => _of(tester, find.byType(KalloButton));

final _cases = [
  const _Case('start', '/start', StartScreen, _button),
  _Case(
    'sign-in',
    '/sign-in',
    SignInScreen,
    (t) => _of(t, find.byType(AuthOptions)),
  ),
  _Case(
    'sign-up',
    '/sign-up',
    SignUpScreen,
    (t) => _of(t, find.byType(AuthOptions)),
  ),
  _Case(
    'email',
    '/sign-in/email',
    EmailAuthScreen,
    (t) => _of(t, find.byType(EmailAuthForm)),
  ),
  _Case(
    'save-plan',
    '/save-plan',
    SavePlanScreen,
    (t) => _of(t, find.byType(AuthOptions)),
  ),
  _Case(
    'save-plan-email',
    '/save-plan/email',
    EmailAuthScreen,
    (t) => _of(t, find.byType(EmailAuthForm)),
  ),
  for (var skips = 0; skips <= 5; skips++)
    _Case(
      'onboarding step ${skips + 1}',
      '/onboarding',
      OnboardingScreen,
      _button,
      skips: skips,
    ),
  _Case(
    'welcome',
    '/welcome',
    WelcomeSetupScreen,
    (t) => _of(t, find.text('Setting up your account')),
    signedIn: true,
    splits: false,
    overrides: [firstRunFinishProvider.overrideWith(_HeldFinish.new)],
  ),
  const _Case(
    'paywall',
    '/paywall',
    PaywallScreen,
    _paywallColumn,
    signedIn: true,
  ),
  const _Case(
    'invite',
    '/circle/invite/pose-invite',
    ConnectScreen,
    _button,
    signedIn: true,
    splits: false,
  ),
];

/// The paywall's column: the table and the decision under or beside it, or
/// beside a fold the decision alone (the table then takes the far pane).
Rect _paywallColumn(WidgetTester tester) {
  final decision = _of(tester, find.byType(PlanCta));
  final layout = WindowLayout.of(tester.element(find.byType(PlanCta)));
  if (layout.twoPane) return decision;
  return _of(tester, find.byType(PlanComparison)).expandToInclude(decision);
}

/// Holds `/welcome` on screen: the flush never finishes.
class _HeldFinish extends FirstRunFinishController {
  _HeldFinish(super.ref);

  @override
  Future<({int? target, String next})> finish() =>
      Completer<({int? target, String next})>().future;
}

Future<void> _open(WidgetTester tester, _Case c) async {
  if (c.route == '/welcome') {
    await tester.pump(const Duration(seconds: 2));
  }
  final skips = c.skips;
  if (skips == null || skips == 0) return;
  await tester.tap(find.text('Continue'));
  await settlePose(tester);
  for (var i = 1; i < skips; i++) {
    await tester.tap(find.text('Skip'));
    await settlePose(tester);
  }
}

/// The centre line the content column stands on: the window's, or in two
/// panes the centre of the column's own half of the display.
double _expectedCentre(WindowLayout layout, {required bool splits}) {
  if (!layout.twoPane || !splits) return layout.size.width / 2;
  return layout.nearLeft
      ? (layout.foldX - kFoldGutter / 2) / 2
      : (layout.foldX + kFoldGutter / 2 + layout.size.width) / 2;
}

/// Checks the keep-clear corners at rest and at points down every
/// scrollable on the page, ending at its end.
Future<void> _expectClear(
  WidgetTester tester,
  Finder screen,
  WindowLayout layout,
  String reason,
) async {
  final hits = <String>[
    ...keepClearCollisions(
      tester,
      screen,
      layout.keepClear,
      covers: _bands(tester),
    ),
  ];
  final scrollables = find.descendant(
    of: screen,
    matching: find.byType(Scrollable),
  );
  for (final element in scrollables.evaluate().toList()) {
    final state = (element as StatefulElement).state as ScrollableState;
    final position = state.position;
    if (axisDirectionToAxis(position.axisDirection) != Axis.vertical) continue;
    if (position.maxScrollExtent <= 0) continue;
    for (final f in [.25, .5, .75, 1.0]) {
      position.jumpTo(position.maxScrollExtent * f);
      await tester.pump();
      hits.addAll([
        for (final hit in keepClearCollisions(
          tester,
          screen,
          layout.keepClear,
          scrolled: true,
          covers: _bands(tester),
        ))
          '$hit (scrolled ${(f * 100).round()}%)',
      ]);
    }
    position.jumpTo(0);
    await tester.pump();
  }
  expect(hits, isEmpty, reason: reason);
}

/// The wizard's button band, pinned over the step's scroll view.
List<Rect> _bands(WidgetTester tester) => [
  for (final element
      in find
          .descendant(
            of: find.byType(OnboardingAnswer),
            matching: find.byType(BackdropSlice),
          )
          .evaluate())
    tester.getRect(find.byElementPredicate((e) => e == element)),
];

void main() {
  setUpAll(initializePoseHarness);

  for (final c in _cases) {
    for (final pose in _columnPoses) {
      testWidgets('${c.name} at ${pose.name} centres on the display', (
        tester,
      ) async {
        final dispose = await bootPose(
          tester,
          pose,
          c.route,
          signedIn: c.signedIn,
          overrides: c.overrides,
        );
        await _open(tester, c);
        final layout = WindowLayout.resolve(pose.size, pose.padding);
        final screen = find.byType(c.screen).last;
        final column = c.column(tester);
        final reason = '${c.name} / ${pose.name}';
        debugPrint('CENTRE $reason: ${column.center.dx} of $column');
        await _expectClear(tester, screen, layout, reason);
        expect(
          column.center.dx,
          moreOrLessEquals(
            _expectedCentre(layout, splits: c.splits),
            epsilon: .5,
          ),
          reason: reason,
        );
        if (layout.twoPane && c.splits) {
          _expectMirroredPanes(tester, layout, reason);
        }
        expect(tester.takeException(), isNull);
        await dispose();
      });
    }
  }
}

/// Every pane frame on the page has its mirror image about the fold: the
/// two halves of the display are the same width, each with its own margin.
void _expectMirroredPanes(
  WidgetTester tester,
  WindowLayout layout,
  String reason,
) {
  // A narrative page's panes clip their content; the paywall split's two
  // sides each carry their own gutter.
  final frames = <Rect>{
    for (final element in [
      ...find
          .descendant(
            of: find.byType(NarrativePanes),
            matching: find.byType(ClipRect),
          )
          .evaluate(),
      ...find
          .descendant(
            of: find.byType(PaywallSplit),
            matching: find.byType(PaywallGutter),
          )
          .evaluate(),
    ])
      if (tester.getRect(find.byElementPredicate((e) => e == element))
          case final rect when rect.height == layout.size.height)
        rect,
  };
  expect(frames, isNotEmpty, reason: reason);
  final width = layout.size.width;
  for (final frame in frames) {
    final mirror = Rect.fromLTRB(
      width - frame.right,
      frame.top,
      width - frame.left,
      frame.bottom,
    );
    expect(
      frames.any(
        (other) =>
            (other.left - mirror.left).abs() < .01 &&
            (other.right - mirror.right).abs() < .01,
      ),
      isTrue,
      reason: '$reason: $frame has no mirror in $frames',
    );
  }
}
