// CI: flutter test test/shell/poses
// Gallery: flutter test --update-goldens --dart-define=DUO_OUT=/absolute/path test/shell/poses
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/dashboard/screens/dashboard_screen.dart';
import 'package:kallo_mobile/features/logging/screens/logging_screen.dart';
import 'package:kallo_mobile/features/logging/widgets/meal_edit/meal_edit_sheet.dart';
import 'package:kallo_mobile/features/logging/widgets/persisted/persisted_meal_card_content.dart';
import 'package:kallo_mobile/features/nutrition/screens/nutrition_screen.dart';
import 'package:kallo_mobile/features/circle/screens/circle_screen.dart';
import 'package:kallo_mobile/features/settings/screens/settings_screen.dart';
import 'package:kallo_mobile/features/auth/screens/sign_in_screen.dart';
import 'package:kallo_mobile/features/paywall/screens/paywall_screen.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_confirm.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_alert_surface.dart';
import 'package:kallo_mobile/shared/widgets/toast/top_toast.dart';
import 'package:kallo_mobile/shared/widgets/toast/top_toast_pill.dart';
import 'package:kallo_mobile/shared/widgets/menu/anchored_menu_layer.dart';

import 'pose_harness.dart';
import 'poses.dart';
import 'review_measurements.dart';

const _out = String.fromEnvironment('DUO_OUT');

typedef Surface = ({String name, String route, Type widget, bool scroll});
const _surfaces = <Surface>[
  (name: 'today', route: '/dashboard', widget: DashboardScreen, scroll: true),
  (name: 'log', route: '/logging', widget: LoggingScreen, scroll: true),
  (
    name: 'nutrition',
    route: '/nutrition',
    widget: NutritionScreen,
    scroll: true,
  ),
  (name: 'circle', route: '/circle', widget: CircleScreen, scroll: true),
  (name: 'settings', route: '/settings', widget: SettingsScreen, scroll: true),
  (name: 'sign-in', route: '/sign-in', widget: SignInScreen, scroll: true),
  (name: 'paywall', route: '/paywall', widget: PaywallScreen, scroll: true),
  (
    name: 'add-sheet',
    route: '/dashboard',
    widget: KalloSheetSurface,
    scroll: false,
  ),
  (
    name: 'weight-sheet',
    route: '/dashboard',
    widget: KalloSheetSurface,
    scroll: true,
  ),
  (
    name: 'meal-edit-sheet',
    route: '/logging',
    widget: MealEditSheet,
    scroll: true,
  ),
  (
    name: 'confirm',
    route: '/dashboard',
    widget: KalloAlertSurface,
    scroll: false,
  ),
  (name: 'toast', route: '/dashboard', widget: TopToastPill, scroll: false),
  (name: 'menu', route: '/logging', widget: AnchoredMenuLayer, scroll: false),
];

Future<void> _capture(WidgetTester tester, String name) async {
  if (_out.isEmpty) return;
  await expectLater(
    find.byType(MaterialApp),
    matchesGoldenFile(Uri.file('$_out/$name.png')),
  );
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

Future<void> _openSheet(WidgetTester tester, String surface) async {
  if (surface == 'confirm' || surface == 'toast') {
    final context = tester.element(find.byType(DashboardScreen));
    if (surface == 'confirm') {
      showKalloConfirm(
        context,
        title: 'Remove meal?',
        description: 'This meal will be removed from your day.',
        confirmLabel: 'Remove',
        cancelLabel: 'Keep meal',
        destructive: true,
      );
    } else {
      showTopToast(context, 'Meal saved');
    }
    await tester.pumpAndSettle();
  }
  if (surface == 'add-sheet' || surface == 'weight-sheet') {
    await tester.tap(find.bySemanticsLabel('Add'));
    await tester.pumpAndSettle();
    if (surface == 'weight-sheet') {
      await tester.tap(find.text('Log weight'));
      await tester.pumpAndSettle();
    }
  }
  if (surface == 'meal-edit-sheet' || surface == 'menu') {
    final card = find.byType(PersistedMealCardContent).first;
    await tester.ensureVisible(card);
    await tester.pumpAndSettle();
    await tester.longPress(card);
    await tester.pumpAndSettle();
    if (surface == 'meal-edit-sheet') {
      await tester.tap(find.text('Edit'));
      await tester.pumpAndSettle();
    }
  }
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
    for (final pose in poses) {
      if (['confirm', 'toast', 'menu'].contains(surface.name) &&
          ![
            'outer-portrait',
            'split-left',
            'inner-portrait',
            'inner-landscape',
          ].contains(pose.name)) {
        continue;
      }
      for (final scale in pose.name == 'outer-portrait' ? [1.0, 1.3] : [1.0]) {
        final suffix = scale == 1 ? '' : '__text-1.3';
        testWidgets('${surface.name} / ${pose.name}$suffix', (tester) async {
          final dispose = await bootPose(
            tester,
            pose,
            surface.route,
            signedIn: surface.name != 'sign-in',
            textScale: scale,
          );
          try {
            await _openSheet(tester, surface.name);
            expect(find.byType(surface.widget), findsOneWidget);
            expect(
              tester.takeException(),
              isNull,
              reason: '${surface.name} / ${pose.name}',
            );
            await _capture(tester, '${surface.name}__${pose.name}$suffix');
            if (_out.isNotEmpty) {
              reviewMeasurements(tester, surface.name, '${pose.name}$suffix');
            }
            if (surface.scroll) {
              await _scrollToEnd(tester, surface.widget);
              if (_out.isNotEmpty) {
                reviewMeasurements(
                  tester,
                  surface.name,
                  '${pose.name}$suffix'
                  '__end',
                );
              }
              await _capture(
                tester,
                '${surface.name}__${pose.name}$suffix'
                '__end',
              );
            }
            expect(tester.takeException(), isNull);
          } finally {
            if (surface.name == 'toast') {
              await tester.pump(const Duration(seconds: 3));
              await tester.pumpAndSettle();
            }
            await dispose();
          }
        });
      }
    }
  }
}
