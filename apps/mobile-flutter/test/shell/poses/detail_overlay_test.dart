import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/settings/screens/steps/about_you_page.dart';
import 'package:kallo_mobile/shared/widgets/form/save_dock.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_confirm.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_alert_surface.dart';
import 'package:kallo_mobile/shell/window/window_layout.dart';
import 'pose_harness.dart';
import 'poses.dart';

const _out = String.fromEnvironment('DUO_OUT');
Future<void> _capture(WidgetTester tester, String name) async {
  if (_out.isEmpty) return;
  expect(Directory(_out).isAbsolute && autoUpdateGoldenFiles, isTrue);
  await expectLater(
    find.byType(MaterialApp),
    matchesGoldenFile(Uri.file('$_out/$name.png')),
  );
}

void main() {
  setUpAll(initializePoseHarness);
  testWidgets('dirty detail preserves window geometry for overlays', (
    tester,
  ) async {
    final dispose = await bootPose(tester, innerLandscape, '/settings');
    final field = find.byType(EditableText).first;
    await tester.enterText(field, '70');
    FocusManager.instance.primaryFocus?.unfocus();
    await settlePose(tester);
    expect(tester.widget<SaveDock>(find.byType(SaveDock)).visible, isTrue);
    await _capture(tester, 'settings-dirty__inner-landscape');
    final context = tester.element(find.byType(AboutYouPage));
    expect(WindowLayout.of(context).viewPadding.right, 84);
    showNhamSheet(
      context,
      builder:
          (_) => const KalloSheetSurface(
            child: SizedBox(
              height: 160,
              child: Center(child: Text('Detail sheet')),
            ),
          ),
    );
    await tester.pumpAndSettle();
    final label = tester.getRect(find.text('Detail sheet'));
    final sheet = tester.getRect(find.byType(SheetContentInset));
    expect(sheet.left, 495.5);
    expect(sheet.right, 867);
    expect(label.center.dx, 681.25);
    debugPrint('FIXB detail sheet $sheet centre ${label.center.dx}');
    await _capture(tester, 'settings-sheet__inner-landscape');
    Navigator.of(tester.element(find.text('Detail sheet'))).pop();
    await tester.pumpAndSettle();
    showKalloConfirm(
      context,
      title: 'Discard changes?',
      description: 'Your edits will be discarded.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
    );
    await tester.pumpAndSettle();
    expect(tester.getRect(find.byType(KalloAlertSurface)).center.dx, 681.25);
    await _capture(tester, 'settings-confirm__inner-landscape');
    await dispose();
  });
  for (final pose in [innerLandscape, outerPortrait]) {
    testWidgets('Log keyboard / ${pose.name}', (tester) async {
      final dispose = await bootPose(tester, pose, '/logging');
      await tester.tap(find.byType(EditableText).last);
      tester.view.viewInsets = FakeViewPadding(
        bottom: 300 * pose.devicePixelRatio,
      );
      tester.view.padding = FakeViewPadding(
        right: pose.padding.right * pose.devicePixelRatio,
      );
      await settlePose(tester);
      final field = tester.getRect(find.byType(EditableText).last);
      expect(field.bottom, lessThanOrEqualTo(pose.size.height - 300));
      debugPrint('FIXB keyboard ${pose.name} field $field');
      await _capture(tester, 'log-keyboard__${pose.name}');
      expect(tester.takeException(), isNull);
      await dispose();
    });
  }
}
