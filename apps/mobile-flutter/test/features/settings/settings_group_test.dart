import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/settings/widgets/list/settings_group.dart';
import 'package:kallo_mobile/shared/widgets/list/grouped_list_card.dart';
import 'package:kallo_mobile/shared/widgets/list/list_row.dart';

/// Settings is the anchor consumer of the shared grouped-card anatomy: a
/// group is a quiet label over ONE white card of rows, and a group with
/// nothing to show must occupy no space at all — the parent stack puts a gap
/// on each side of it, and a header floating above an empty card is what
/// produced the void that used to sit above the feedback section.
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
    expect(find.byType(GroupedListCard), findsNothing);
    expect(tester.getSize(find.byType(SettingsGroup)).height, 0);
  });

  testWidgets('a group with rows renders its label above ONE card', (
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
    expect(find.byType(GroupedListCard), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('Tài khoản')).dy,
      lessThan(tester.getTopLeft(find.text('Đăng xuất')).dy),
    );
    // The label takes NO extra indent — it starts on the page's own inset
    // while the card's 16 steps its rows in from it.
    expect(
      tester.getTopLeft(find.text('Tài khoản')).dx,
      lessThan(tester.getTopLeft(find.text('Đăng xuất')).dx),
    );
  });

  testWidgets('a busy row swaps its value/chevron for a spinner', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        SettingsGroup(
          label: 'Tài khoản',
          children: [
            ListRow(
              label: 'Xuất dữ liệu',
              busy: true,
              enabled: false,
              showChevron: true,
              onTap: () {},
            ),
          ],
        ),
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.byIcon(Icons.chevron_right), findsNothing);
  });
}
