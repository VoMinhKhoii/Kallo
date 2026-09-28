import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/settings/logic/settings_spacing.dart';

/// Every Settings page pads its list with [SettingsSpacing.rowList]. `/settings`
/// is a root route with no `Scaffold`, so that padding is the ONLY thing that
/// can keep a page's last control (a Save, the delete button) scrollable out
/// from under the keyboard.
void main() {
  Future<EdgeInsets> padFor(
    WidgetTester tester, {
    required double homeIndicator,
    required double keyboard,
  }) async {
    late EdgeInsets padding;
    await tester.pumpWidget(
      MediaQuery(
        data: MediaQueryData(
          viewPadding: EdgeInsets.only(bottom: homeIndicator),
          viewInsets: EdgeInsets.only(bottom: keyboard),
        ),
        child: Builder(
          builder: (context) {
            padding = SettingsSpacing.rowList(context);
            return const SizedBox();
          },
        ),
      ),
    );
    return padding;
  }

  testWidgets('keyboard down: clears the home indicator', (tester) async {
    final padding = await padFor(tester, homeIndicator: 34, keyboard: 0);
    expect(padding.bottom, 32 + 34);
  });

  testWidgets('keyboard up: clears the keyboard, not keyboard + indicator', (
    tester,
  ) async {
    final padding = await padFor(tester, homeIndicator: 34, keyboard: 336);
    expect(padding.bottom, 32 + 336);
  });
}
