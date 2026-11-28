// CI: flutter test test/shell/poses
// Gallery: flutter test --update-goldens --dart-define=DUO_OUT=/absolute/path test/shell/poses
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/auth/screens/email_auth_screen.dart';
import 'package:kallo_mobile/features/auth/screens/sign_in_screen.dart';
import 'package:kallo_mobile/features/auth/screens/sign_up_screen.dart';
import 'package:kallo_mobile/features/circle/screens/connect_screen.dart';
import 'package:kallo_mobile/features/auth/widgets/auth_submit_button.dart';
import 'package:kallo_mobile/features/circle/screens/circle_screen.dart';
import 'package:kallo_mobile/features/circle/screens/circle_thread_screen.dart';
import 'package:kallo_mobile/features/circle/widgets/thread/reply_pill.dart';
import 'package:kallo_mobile/features/dashboard/screens/dashboard_screen.dart';
import 'package:kallo_mobile/features/logging/screens/logging_screen.dart';
import 'package:kallo_mobile/features/logging/widgets/meal_edit/meal_edit_sheet.dart';
import 'package:kallo_mobile/features/logging/widgets/persisted/persisted_meal_card_content.dart';
import 'package:kallo_mobile/features/nutrition/screens/nutrition_screen.dart';
import 'package:kallo_mobile/features/onboarding/providers/first_run_finish.dart';
import 'package:kallo_mobile/features/onboarding/screens/onboarding_screen.dart';
import 'package:kallo_mobile/features/onboarding/screens/save_plan_screen.dart';
import 'package:kallo_mobile/features/onboarding/screens/welcome_setup_screen.dart';
import 'package:kallo_mobile/features/onboarding/screens/start_screen.dart';
import 'package:kallo_mobile/features/paywall/screens/paywall_screen.dart';
import 'package:kallo_mobile/features/paywall/widgets/pitch/plan_comparison.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/paywall_buy_band.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/plan_toggle.dart';
import 'package:kallo_mobile/features/settings/screens/settings_screen.dart';
import 'package:kallo_mobile/features/settings/screens/steps/about_you_page.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_alert_surface.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_confirm.dart';
import 'package:kallo_mobile/shared/widgets/gauge/gauge_dial.dart';
import 'package:kallo_mobile/shared/widgets/list/grouped_list_card.dart';
import 'package:kallo_mobile/shared/widgets/menu/anchored_menu_layer.dart';
import 'package:kallo_mobile/shared/widgets/menu/kallo_menu_card.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet.dart';
import 'package:kallo_mobile/shared/widgets/toast/top_toast.dart';
import 'package:kallo_mobile/shared/widgets/toast/top_toast_pill.dart';

import 'harness/pose_harness.dart';
import 'harness/poses.dart';

const _out = String.fromEnvironment('DUO_OUT');

/// Overlays are checked only where their frame changes: the outer display,
/// Split View and the inner display both ways.
const _overlayPoses = {
  'outer-portrait',
  'split-left',
  'inner-portrait',
  'inner-landscape',
};

/// Poses rendered again at 1.3x text, the largest size the layouts promise.
const _textScalePoses = {'outer-portrait', 'inner-landscape', 'inner-portrait'};

/// Geometry recorded beside the renders, so review numbers are reproducible.
/// It goes to the gallery log, not into golden pixels.
class Measurements {
  Measurements(this.tester);
  final WidgetTester tester;
  final values = <String, Object>{};

  /// Records [finder]'s first rect under [name] when it is on screen.
  void rect(String name, Finder finder) {
    if (finder.evaluate().isNotEmpty) {
      values[name] = tester.getRect(finder.first);
    }
  }
}

/// One screen or overlay the gallery renders. Everything particular to it
/// rides on its entry, so adding a surface is one entry in [_surfaces].
class Surface {
  const Surface(
    this.name,
    this.route,
    this.widget, {
    this.scroll = true,
    this.signedIn = true,
    this.columnFree = false,
    this.overrides = const [],
    this.poses,
    this.open,
    this.check,
    this.measure,
    this.close,
  });

  final String name;
  final String route;

  /// The widget that must be on screen once [open] has run.
  final Type widget;

  /// Whether the gallery also scrolls it to its end and renders that.
  final bool scroll;

  /// False for the flows a signed-out user sees.
  final bool signedIn;

  /// A screen that puts none of our controls in the control column. It is
  /// also rendered with the column on the left, and its renders tint the
  /// column's keep-clear corners.
  final bool columnFree;

  /// Provider overrides on top of the pose fixtures.
  final List<Override> overrides;

  /// The pose names it is rendered at; null renders every pose.
  final Set<String>? poses;

  /// The steps from [route] to the surface, such as opening a sheet.
  final Future<void> Function(WidgetTester tester)? open;

  /// Assertions for this surface at one pose, run once it is open.
  final void Function(WidgetTester tester, Pose pose)? check;

  /// What to record in the gallery log under DUO_OUT.
  final void Function(Measurements m)? measure;

  /// Clean-up before the app is torn down, such as letting a toast expire.
  final Future<void> Function(WidgetTester tester)? close;
}

Future<void> _openAddSheet(WidgetTester tester) async {
  await tester.tap(find.bySemanticsLabel('Add'));
  await tester.pumpAndSettle();
}

Future<void> _holdFirstMeal(WidgetTester tester) async {
  final card = find.byType(PersistedMealCardContent).first;
  await tester.ensureVisible(card);
  await tester.pumpAndSettle();
  await tester.longPress(card);
  await tester.pumpAndSettle();
}

Future<void> _continueOnboarding(WidgetTester tester) async {
  await tester.tap(find.text('Continue'));
  await settlePose(tester);
}

void _measureOnboarding(Measurements m) {
  m.rect('Skip', find.text('Skip'));
  m.values['question count'] =
      find.text('Where do you cook?').evaluate().length;
}

final _surfaces = <Surface>[
  Surface(
    'today',
    '/dashboard',
    DashboardScreen,
    measure: (m) {
      m.rect('salmon', find.text('Grilled salmon, roasted potatoes'));
      m.rect('kcal', find.text('620 kcal'));
    },
  ),
  Surface(
    'log',
    '/logging',
    LoggingScreen,
    measure:
        (m) =>
            m.values['readout scales'] =
                m.tester
                    .widgetList<GaugeDial>(find.byType(GaugeDial))
                    .map((dial) => dial.readoutScale)
                    .toList(),
  ),
  Surface(
    'nutrition',
    '/nutrition',
    NutritionScreen,
    measure: (m) {
      m.values['range font sizes'] = [
        for (final label in ['7 days', '30 days', '90 days'])
          MediaQuery.textScalerOf(m.tester.element(find.text(label))).scale(16),
      ];
      m.rect('30 days', find.text('30 days'));
      m.rect('90 days', find.text('90 days'));
      m.rect('axis 1500', find.text('1500'));
    },
  ),
  Surface(
    'circle',
    '/circle',
    CircleScreen,
    measure: (m) {
      for (final text in ['460 kcal', 'P 22g', 'C 48g', 'F 20g']) {
        m.rect(text, find.text(text));
      }
    },
  ),
  Surface(
    'settings',
    '/settings',
    SettingsScreen,
    measure: (m) => m.rect('card', find.byType(GroupedListCard)),
  ),
  const Surface(
    'sign-in',
    '/sign-in',
    SignInScreen,
    signedIn: false,
    columnFree: true,
  ),
  Surface(
    'paywall',
    '/paywall',
    PaywallScreen,
    columnFree: true,
    measure: (m) {
      m.rect('band', find.byType(PaywallBuyBand));
      m.rect('toggle', find.byType(PlanToggle));
      m.rect('table', find.byType(PlanComparison));
    },
  ),
  const Surface(
    'add-sheet',
    '/dashboard',
    KalloSheetSurface,
    scroll: false,
    open: _openAddSheet,
  ),
  Surface(
    'weight-sheet',
    '/dashboard',
    KalloSheetSurface,
    open: (tester) async {
      await _openAddSheet(tester);
      await tester.tap(find.text('Log weight'));
      await tester.pumpAndSettle();
    },
  ),
  Surface(
    'meal-edit-sheet',
    '/logging',
    MealEditSheet,
    open: (tester) async {
      await _holdFirstMeal(tester);
      await tester.tap(find.text('Edit'));
      await tester.pumpAndSettle();
    },
  ),
  Surface(
    'confirm',
    '/dashboard',
    KalloAlertSurface,
    scroll: false,
    poses: _overlayPoses,
    open: (tester) async {
      showKalloConfirm(
        tester.element(find.byType(DashboardScreen)),
        title: 'Remove meal?',
        description: 'This meal will be removed from your day.',
        confirmLabel: 'Remove',
        cancelLabel: 'Keep meal',
        destructive: true,
      );
      await tester.pumpAndSettle();
    },
    measure: (m) => m.rect('alert', find.byType(KalloAlertSurface)),
  ),
  Surface(
    'toast',
    '/dashboard',
    TopToastPill,
    scroll: false,
    poses: _overlayPoses,
    open: (tester) async {
      showTopToast(tester.element(find.byType(DashboardScreen)), 'Meal saved');
      await tester.pumpAndSettle();
    },
    measure: (m) => m.rect('toast', find.byType(TopToastPill)),
    close: (tester) async {
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();
    },
  ),
  Surface(
    'menu',
    '/logging',
    AnchoredMenuLayer,
    scroll: false,
    poses: _overlayPoses,
    open: _holdFirstMeal,
    measure: (m) => m.rect('menu', find.byType(KalloMenuCard)),
  ),
  Surface(
    'thread',
    '/circle/thread-detail',
    CircleThreadScreen,
    check: (tester, pose) {
      if (pose.name != 'inner-landscape') return;
      expect(
        tester.getRect(find.text('Replies')).top,
        closeTo(tester.getRect(find.text('Circle')).top, .5),
      );
    },
    measure: (m) {
      m.rect('Circle', find.text('Circle'));
      m.rect('Replies', find.text('Replies'));
      m.rect('composer', find.byType(ReplyPill));
    },
  ),
  Surface(
    'body-metrics',
    '/settings',
    AboutYouPage,
    open: (tester) async {
      if (find.byType(AboutYouPage).evaluate().isNotEmpty) return;
      await tester.tap(find.text('Body metrics'));
      await tester.pumpAndSettle();
    },
  ),
  const Surface(
    'start',
    '/start',
    StartScreen,
    scroll: false,
    signedIn: false,
    columnFree: true,
  ),
  Surface(
    'email-auth',
    '/sign-in/email',
    EmailAuthScreen,
    signedIn: false,
    columnFree: true,
    measure: (m) {
      m.rect('Send code', find.text('Send code'));
      m.rect('submit button', find.byType(AuthSubmitButton));
    },
  ),
  Surface(
    'countries',
    '/onboarding',
    OnboardingScreen,
    signedIn: false,
    columnFree: true,
    open: _continueOnboarding,
    check: (tester, pose) {
      if (pose.name != 'pip-pinned') return;
      expect(find.text('Where do you cook?'), findsOneWidget);
    },
    measure: _measureOnboarding,
  ),
  Surface(
    'metrics',
    '/onboarding',
    OnboardingScreen,
    signedIn: false,
    columnFree: true,
    open: (tester) => _skipOnboarding(tester, 1),
    measure: _measureOnboarding,
  ),
  const Surface(
    'language',
    '/onboarding',
    OnboardingScreen,
    signedIn: false,
    columnFree: true,
  ),
  Surface(
    'goal',
    '/onboarding',
    OnboardingScreen,
    signedIn: false,
    columnFree: true,
    open: (tester) => _skipOnboarding(tester, 2),
  ),
  Surface(
    'cooking',
    '/onboarding',
    OnboardingScreen,
    signedIn: false,
    columnFree: true,
    open: (tester) => _skipOnboarding(tester, 3),
  ),
  Surface(
    'target',
    '/onboarding',
    OnboardingScreen,
    signedIn: false,
    columnFree: true,
    open: (tester) => _skipOnboarding(tester, 4),
  ),
  const Surface(
    'sign-up',
    '/sign-up',
    SignUpScreen,
    signedIn: false,
    columnFree: true,
  ),
  const Surface(
    'save-plan',
    '/save-plan',
    SavePlanScreen,
    signedIn: false,
    columnFree: true,
  ),
  const Surface(
    'save-plan-email',
    '/save-plan/email',
    EmailAuthScreen,
    signedIn: false,
    columnFree: true,
  ),
  Surface(
    'welcome',
    '/welcome',
    WelcomeSetupScreen,
    scroll: false,
    columnFree: true,
    overrides: [firstRunFinishProvider.overrideWith((ref) => _HeldFinish(ref))],
    // Past the interstitial's minimum window, so no timer outlives the test.
    open: (tester) => tester.pump(const Duration(seconds: 2)),
  ),
  const Surface(
    'invite',
    '/circle/invite/pose-invite',
    ConnectScreen,
    scroll: false,
    columnFree: true,
  ),
];

/// Walks the wizard from its first screen past [skips] screens.
Future<void> _skipOnboarding(WidgetTester tester, int skips) async {
  await _continueOnboarding(tester);
  for (var i = 0; i < skips; i++) {
    await tester.tap(find.text('Skip'));
    await settlePose(tester);
  }
}

/// Holds `/welcome` on screen: the flush never finishes.
class _HeldFinish extends FirstRunFinishController {
  _HeldFinish(super.ref);

  @override
  Future<({int? target, String next})> finish() =>
      Completer<({int? target, String next})>().future;
}

Future<void> _capture(WidgetTester tester, String name) async {
  if (_out.isEmpty) return;
  await expectLater(
    find.byType(MaterialApp),
    matchesGoldenFile(Uri.file('$_out/$name.png')),
  );
}

void _measure(WidgetTester tester, Surface surface, String pose) {
  if (_out.isEmpty) return;
  final m = Measurements(tester);
  surface.measure?.call(m);
  debugPrint('REVIEW ${surface.name}/$pose ${m.values}');
}

/// Exercise every intermediate frame while dragging, including lazy cards.
Future<void> _scrollToEnd(WidgetTester tester, Type surface) async {
  final scrollables = find.descendant(
    of: find.byType(surface),
    matching: find.byType(Scrollable),
  );
  Finder? target;
  double largest = 0;
  for (final element in scrollables.evaluate()) {
    final state = (element as StatefulElement).state as ScrollableState;
    if (axisDirectionToAxis(state.position.axisDirection) != Axis.vertical) {
      continue;
    }
    final height = state.position.viewportDimension;
    final rect = tester.getRect(
      find.byElementPredicate((candidate) => candidate == element),
    );
    final window =
        Offset.zero & (tester.view.physicalSize / tester.view.devicePixelRatio);
    if (state.position.maxScrollExtent <= 0 || !rect.overlaps(window)) continue;
    if (height > largest) {
      largest = height;
      target = find.byElementPredicate((candidate) => candidate == element);
    }
  }
  if (target == null) return;
  final position = tester.state<ScrollableState>(target).position;
  for (var i = 0; i < 60 && position.extentAfter > .5; i++) {
    final before = position.pixels;
    final direction = position.axisDirection == AxisDirection.up ? 1.0 : -1.0;
    final rect = tester.getRect(target);
    // The feed extends behind its pinned composer; start near the top of
    // its viewport, where a finger actually reaches the list.
    await tester.dragFrom(
      Offset(rect.center.dx, rect.top + rect.height * .2),
      Offset(0, direction * largest * .65),
    );
    await settlePose(tester);
    expect(tester.takeException(), isNull, reason: 'while scrolling $surface');
    if ((position.pixels - before).abs() < .1) break;
  }
  expect(
    position.extentAfter,
    lessThanOrEqualTo(.5),
    reason: '$surface did not reach end',
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    if (_out.isNotEmpty) {
      if (!autoUpdateGoldenFiles || !Directory(_out).isAbsolute) {
        throw ArgumentError(
          'DUO_OUT requires an absolute path and --update-goldens',
        );
      }
    }
    await initializePoseHarness();
  });

  for (final surface in _surfaces) {
    for (final pose in [...poses, if (surface.columnFree) ...columnLeftPoses]) {
      if (surface.poses != null && !surface.poses!.contains(pose.name)) {
        continue;
      }
      for (final scale
          in _textScalePoses.contains(pose.name) ? [1.0, 1.3] : [1.0]) {
        final suffix = scale == 1 ? '' : '__text-1.3';
        testWidgets('${surface.name} / ${pose.name}$suffix', (tester) async {
          final dispose = await bootPose(
            tester,
            pose,
            surface.route,
            signedIn: surface.signedIn,
            textScale: scale,
            overrides: surface.overrides,
            keepClearTint: surface.columnFree && _out.isNotEmpty,
          );
          try {
            await surface.open?.call(tester);
            surface.check?.call(tester, pose);
            expect(find.byType(surface.widget), findsOneWidget);
            expect(
              tester.takeException(),
              isNull,
              reason: '${surface.name} / ${pose.name}',
            );
            await _capture(tester, '${surface.name}__${pose.name}$suffix');
            _measure(tester, surface, '${pose.name}$suffix');
            if (surface.scroll) {
              await _scrollToEnd(tester, surface.widget);
              _measure(tester, surface, '${pose.name}${suffix}__end');
              await _capture(
                tester,
                '${surface.name}__${pose.name}$suffix'
                '__end',
              );
            }
            expect(tester.takeException(), isNull);
          } finally {
            await surface.close?.call(tester);
            await dispose();
          }
        });
      }
    }
  }
}
