import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/chrome/inline_nav_bar.dart';

import '../../../features/onboarding/onboarding_test_support.dart';

/// The sub-page bar is the platform's own [CupertinoNavigationBar], set in
/// the app's type: "‹ parent" on the leading edge, the page's title centred
/// on the BAR. A parent too long to sit beside the title gives way to the
/// localized "Back" (the SDK's rule) instead of ellipsising into nothing.
Future<void> _pump(
  WidgetTester tester,
  String parent, {
  String title = 'Mục tiêu & tốc độ',
  VoidCallback? onBack,
}) async {
  await tester.pumpWidget(
    localizedHome(
      Scaffold(
        body: SizedBox(
          width: 366,
          child: InlineNavBar(
            title: title,
            parentTitle: parent,
            onBack: onBack,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initOnboardingTest);

  testWidgets('is the Cupertino bar, naming the parent, title centred', (
    tester,
  ) async {
    await _pump(tester, 'Settings', title: 'Hồ sơ');
    expect(find.byType(CupertinoNavigationBar), findsOneWidget);
    expect(find.byType(CupertinoButton), findsOneWidget);
    expect(find.text('Settings'), findsOneWidget);
    final title = tester.getCenter(find.text('Hồ sơ'));
    final bar = tester.getCenter(find.byType(InlineNavBar));
    expect((title.dx - bar.dx).abs(), lessThan(1));
  });

  testWidgets('a crowded title moves clear of the back button', (tester) async {
    // iOS's own layout: centred when there is room, nudged right rather than
    // run under the back label when there is not.
    await _pump(tester, 'Settings', title: 'Thói quen nấu nướng hằng ngày');
    final back = tester.getRect(find.byType(CupertinoButton));
    final title = tester.getRect(find.text('Thói quen nấu nướng hằng ngày'));
    expect(title.left, greaterThanOrEqualTo(back.right));
  });

  testWidgets('a parent too long to fit reads the localized "Back"', (
    tester,
  ) async {
    await _pump(tester, 'How do you want to log this meal today?');
    final back =
        CupertinoLocalizations.of(
          tester.element(find.byType(InlineNavBar)),
        ).backButtonLabel;
    expect(find.text(back), findsOneWidget);
  });

  testWidgets('tapping back calls onBack', (tester) async {
    var backs = 0;
    await _pump(tester, 'Settings', onBack: () => backs++);
    await tester.tap(find.byType(CupertinoButton));
    expect(backs, 1);
  });

  testWidgets('without onBack it pops the nearest navigator', (tester) async {
    await tester.pumpWidget(
      localizedHome(
        Builder(
          builder:
              (context) => TextButton(
                onPressed:
                    () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder:
                            (_) => const Scaffold(
                              body: InlineNavBar(
                                title: 'Child',
                                parentTitle: 'Parent',
                              ),
                            ),
                      ),
                    ),
                child: const Text('open'),
              ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('Child'), findsOneWidget);
    await tester.tap(find.byType(CupertinoButton));
    await tester.pumpAndSettle();
    expect(find.text('Child'), findsNothing);
  });
}
