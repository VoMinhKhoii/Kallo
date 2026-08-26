import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/settings/widgets/list/settings_group.dart';

/// The settings root separates groups with whitespace alone, and the parent
/// stack owns the gap on either side of each one. A group that renders a header
/// over zero rows — or that collapses to nothing while its gaps remain — is
/// what produced the 48px void that used to sit above the feedback section.
void main() {
  Widget host(Widget child) =>
      MaterialApp(home: Scaffold(body: Column(children: [child])));

  testWidgets('an empty group occupies no space and shows no header', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(const SettingsGroup(label: 'Tài khoản', children: [])),
    );

    expect(find.text('Tài khoản'), findsNothing);
    expect(tester.getSize(find.byType(SettingsGroup)).height, 0);
  });

  testWidgets('a group with rows renders its header above them', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        const SettingsGroup(
          label: 'Tài khoản',
          children: [SizedBox(height: 40, child: Text('Đăng xuất'))],
        ),
      ),
    );

    expect(find.text('Tài khoản'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('Tài khoản')).dy,
      lessThan(tester.getTopLeft(find.text('Đăng xuất')).dy),
    );
  });
}
