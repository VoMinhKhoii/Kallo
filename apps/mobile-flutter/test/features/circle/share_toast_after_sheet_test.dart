import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet.dart';
import 'package:kallo_mobile/shared/widgets/toast/top_toast.dart';

/// The share sheet confirms itself with a toast raised AFTER it pops, and that
/// toast carries the only undo affordance in the feature. Two separate attempts
/// at it rendered nothing at all — first from the sheet's own dying context,
/// then from `Navigator.of(context, rootNavigator: true).context`, which sits
/// ABOVE the overlay `showTopToast` searches. Both failed silently: no toast,
/// no undo, no error.
///
/// These tests pin the contract that actually matters — a toast raised from the
/// OPENING context, after the sheet is gone, is visible and its action runs.
void main() {
  testWidgets('a toast raised from the opening context survives the sheet',
      (tester) async {
    var undone = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (hostContext) => Center(
              child: GestureDetector(
                onTap: () async {
                  final outcome = await showNhamSheet<String>(
                    hostContext,
                    builder: (sheetContext) => GestureDetector(
                      onTap: () => Navigator.of(sheetContext).pop('shared'),
                      child: const SizedBox(
                        height: 200,
                        width: 200,
                        child: Text('close'),
                      ),
                    ),
                  );
                  if (outcome == null || !hostContext.mounted) return;
                  showTopToast(
                    hostContext,
                    'Đã chia phần',
                    actionLabel: 'Hoàn tác',
                    onAction: () => undone = true,
                  );
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    // Close the sheet the way a successful share does: pop with a result.
    await tester.tap(find.text('close'));
    await tester.pumpAndSettle();

    // The confirmation is on screen even though the sheet that triggered it is
    // gone. This is the assertion both earlier attempts would have failed.
    expect(find.text('Đã chia phần'), findsOneWidget);
    expect(find.text('Hoàn tác'), findsOneWidget);

    await tester.tap(find.text('Hoàn tác'));
    await tester.pumpAndSettle();
    expect(undone, isTrue);
  });

  testWidgets('a NavigatorState context cannot raise one — the trap, pinned',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (hostContext) => Center(
              child: GestureDetector(
                onTap: () {
                  // The overlay lives INSIDE the Navigator, so a lookup that
                  // walks ancestors from the NavigatorState's own context never
                  // reaches it.
                  final navContext =
                      Navigator.of(hostContext, rootNavigator: true).context;
                  showTopToast(navContext, 'không bao giờ hiện');
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('không bao giờ hiện'), findsNothing);
  });
}
