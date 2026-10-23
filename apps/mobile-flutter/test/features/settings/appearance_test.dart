import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:kallo_mobile/shared/widgets/list/list_row.dart';
import 'package:kallo_mobile/features/settings/widgets/appearance/appearance_row.dart';
import 'package:kallo_mobile/theme/kallo_palette.dart';
import 'package:kallo_mobile/theme/theme_controller.dart';

import 'settings_test_support.dart';

/// Settings → Appearance: the row names the current choice, and its sheet
/// offers the four in order and applies a pick at once.
void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  tearDown(() => KalloPalette.apply(KalloPaletteId.light));

  testWidgets('picking Tối paints Dark, closes the sheet and is stored', (
    tester,
  ) async {
    await pumpSettingsPage(
      tester,
      const Scaffold(body: Column(children: [AppearanceRow()])),
    );
    expect(find.text('Giao diện'), findsOneWidget);
    expect(find.text('Theo hệ thống'), findsOneWidget);

    await tester.tap(find.text('Giao diện'));
    await tester.pumpAndSettle();

    final options = ['Theo hệ thống', 'Sáng', 'Tối', 'Aurora'];
    final tops = [
      for (final label in options) tester.getTopLeft(find.text(label).last).dy,
    ];
    expect(tops, orderedEquals([...tops]..sort()));
    for (final (label, icon) in [
      ('Theo hệ thống', LucideIcons.monitor300),
      ('Sáng', LucideIcons.sun300),
      ('Tối', LucideIcons.moon300),
      ('Aurora', LucideIcons.sunset300),
    ]) {
      final row = find.ancestor(
        of: find.text(label).last,
        matching: find.byType(ListRow),
      );
      expect(
        find.descendant(of: row, matching: find.byIcon(icon)),
        findsOneWidget,
        reason: '$label shows its icon',
      );
    }

    await tester.tap(find.text('Tối'));
    await tester.pumpAndSettle();

    expect(find.text('Sáng'), findsNothing, reason: 'the sheet closed');
    expect(find.text('Tối'), findsOneWidget, reason: 'the row says Dark');
    expect(KalloPalette.currentId, KalloPaletteId.dark);
    expect(
      await const FlutterSecureStorage().read(key: kThemeStorageKey),
      'dark',
    );
  });
}
