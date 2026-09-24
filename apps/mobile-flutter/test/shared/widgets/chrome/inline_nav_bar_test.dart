import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/chrome/inline_nav_bar.dart';

import '../../../features/onboarding/onboarding_test_support.dart';

/// The sub-page bar: "‹ parent" on the leading edge, the page's title centred
/// on the BAR. A parent too long to sit beside the title gives way to "Back"
/// (iOS's rule) instead of running under it or ellipsising into nothing.
Future<void> _pump(
  WidgetTester tester,
  String parent, {
  VoidCallback? onBack,
}) => tester.pumpWidget(
  localizedHome(
    Scaffold(
      body: SizedBox(
        width: 366,
        child: InlineNavBar(
          title: 'Mục tiêu & tốc độ',
          parentTitle: parent,
          onBack: onBack,
        ),
      ),
    ),
  ),
);

void main() {
  setUpAll(initOnboardingTest);

  testWidgets('names the parent when it fits and centres the title', (
    tester,
  ) async {
    await _pump(tester, 'Settings');
    await tester.pumpAndSettle();
    expect(find.text('Settings'), findsOneWidget);
    final title = tester.getCenter(find.text('Mục tiêu & tốc độ'));
    final bar = tester.getCenter(find.byType(InlineNavBar));
    expect((title.dx - bar.dx).abs(), lessThan(1));
  });

  testWidgets('a parent too long to fit reads "Back"', (tester) async {
    await _pump(tester, 'How do you want to log this meal today?');
    await tester.pumpAndSettle();
    expect(find.text(tr('common.back')), findsOneWidget);
  });

  testWidgets('tapping the back group calls onBack', (tester) async {
    var backs = 0;
    await _pump(tester, 'Settings', onBack: () => backs++);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Settings'));
    expect(backs, 1);
  });
}
