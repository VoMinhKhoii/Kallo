import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:kallo_mobile/shared/widgets/list/list_row.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

Widget _wrap(Widget child) =>
    MaterialApp(home: Scaffold(body: Center(child: child)));

/// The Settings anchor anatomy, generalized app-wide by the native pass —
/// every grouped card rides on this row, so its behavior is load-bearing.
void main() {
  testWidgets('the whole row is the tap target and meets the 52pt floor', (
    tester,
  ) async {
    var taps = 0;
    await tester.pumpWidget(
      _wrap(
        SizedBox(
          width: 358,
          child: ListRow(
            icon: LucideIcons.bell300,
            label: 'Notifications',
            value: 'On',
            showChevron: true,
            onTap: () => taps++,
          ),
        ),
      ),
    );

    expect(tester.getSize(find.byType(ListRow)).height,
        greaterThanOrEqualTo(52));

    // Tap the quiet value text, far from the label — still the row's tap.
    await tester.tap(find.text('On'));
    expect(taps, 1);
  });

  testWidgets('a subline grows the row to 60pt and joins the semantics', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        SizedBox(
          width: 358,
          child: ListRow(
            label: 'Account',
            subline: 'khoi@example.com',
            onTap: () {},
          ),
        ),
      ),
    );
    expect(tester.getSize(find.byType(ListRow)).height,
        greaterThanOrEqualTo(60));
    expect(
      find.bySemanticsLabel('Account, khoi@example.com'),
      findsOneWidget,
    );
  });

  testWidgets('busy swaps the trailing affordance for a spinner', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        SizedBox(
          width: 358,
          child: ListRow(
            label: 'Export data',
            showChevron: true,
            busy: true,
            enabled: false,
            onTap: () {},
          ),
        ),
      ),
    );
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.byIcon(LucideIcons.chevronRight300), findsNothing);
    await tester.pump(const Duration(seconds: 1)); // let the spinner spin
  });

  testWidgets('a busy row ignores taps without being told twice', (
    tester,
  ) async {
    // `busy` shows a spinner where the chevron was, so the row is visibly
    // mid-action — but it stayed tappable unless every call site ALSO passed
    // `enabled: false`, and one forgetting that renders a spinner on a live
    // target. Busy IS not-tappable.
    var taps = 0;
    await tester.pumpWidget(
      _wrap(
        SizedBox(
          width: 358,
          child: ListRow(label: 'Restore', busy: true, onTap: () => taps++),
        ),
      ),
    );
    await tester.tap(find.text('Restore'), warnIfMissed: false);
    expect(taps, 0);
    await tester.pump(const Duration(seconds: 1)); // let the spinner spin
  });

  testWidgets('a disabled row ignores taps and dims', (tester) async {
    var taps = 0;
    await tester.pumpWidget(
      _wrap(
        SizedBox(
          width: 358,
          child: ListRow(
            label: 'Sign out',
            danger: true,
            enabled: false,
            onTap: () => taps++,
          ),
        ),
      ),
    );
    await tester.tap(find.text('Sign out'), warnIfMissed: false);
    expect(taps, 0);
    final label = tester.widget<Text>(find.text('Sign out'));
    expect(label.style?.color, KalloColors.danger);
  });
}
