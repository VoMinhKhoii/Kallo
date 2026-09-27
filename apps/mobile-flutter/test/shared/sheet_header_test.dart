import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet_header.dart';
import 'package:kallo_mobile/shared/widgets/sheet/sheet_capsule_button.dart';
import 'package:kallo_mobile/shared/widgets/sheet/sheet_circle_button.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import '../l10n_test_loader.dart';

/// The sheet chrome every sheet inherits: a grabber saying the surface can be
/// dragged, and a close X that starts on the sheet's own content inset.
Widget _app({Widget header = const KalloSheetHeader(title: 'Log weight')}) =>
    EasyLocalization(
      supportedLocales: const [Locale('en')],
      path: 'assets/l10n',
      fallbackLocale: const Locale('en'),
      assetLoader: const FsL10nLoader(),
      child: Builder(
        builder:
            (context) => MaterialApp(
              localizationsDelegates: context.localizationDelegates,
              supportedLocales: context.supportedLocales,
              locale: context.locale,
              home: Scaffold(body: KalloSheetSurface(child: header)),
            ),
      ),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  testWidgets('the header carries a grabber above the title row', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    // The grabber: a 36x5 rounded bar, centred, near the sheet's top edge.
    final grabber = find.byWidgetPredicate(
      (w) =>
          w is Container &&
          w.constraints == const BoxConstraints.tightFor(width: 36, height: 5),
    );
    expect(grabber, findsOneWidget, reason: 'the grabber is missing');

    final bar = tester.getSize(grabber);
    expect(bar.width, 36);
    expect(bar.height, 5);

    final header = tester.getRect(find.byType(KalloSheetHeader));
    final barRect = tester.getRect(grabber);
    final title = tester.getRect(find.text('Log weight'));
    expect(
      barRect.top - header.top,
      closeTo(KalloSpacing.sp2, 0.5),
      reason: 'the grabber sits ~8pt off the sheet top',
    );
    expect(
      barRect.bottom,
      lessThan(title.top),
      reason: 'the grabber sits ABOVE the title row',
    );
    expect(
      barRect.center.dx,
      closeTo(header.center.dx, 0.5),
      reason: 'the grabber is centred',
    );
  });

  testWidgets('the close circle is concentric with the sheet corner', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    final header = tester.getRect(find.byType(KalloSheetHeader));
    final circle = tester.getRect(
      find.descendant(
        of: find.byType(SheetCircleButton),
        matching: find.byType(Container),
      ),
    );

    // 36pt, 16pt from the top AND the side, top-aligned — so its centre is
    // the centre of the 34pt corner and the gap is even round the curve.
    expect(circle.size, const Size.square(SheetCircleButton.size));
    expect(circle.left - header.left, closeTo(kSheetContentInset, 0.5));
    expect(circle.top - header.top, closeTo(kSheetContentInset, 0.5));
    expect(
      circle.center - header.topLeft,
      const Offset(kSheetRadius, kSheetRadius),
      reason: 'the circle and the corner must share one centre',
    );

    // The target still honours 44pt, growing from the circle's leading edge.
    final target = tester.getSize(
      find.descendant(
        of: find.byType(SheetCircleButton),
        matching: find.byType(CupertinoButton),
      ),
    );
    expect(target.width, greaterThanOrEqualTo(44));
    expect(target.height, greaterThanOrEqualTo(44));
    expect(find.byIcon(LucideIcons.x300), findsOneWidget);
  });

  testWidgets('a trailing capsule shares the circle\'s line', (tester) async {
    await tester.pumpWidget(
      _app(
        header: KalloSheetHeader(
          title: 'Barcode',
          trailing: SheetCapsuleButton(label: 'Edit', onTap: () {}),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final header = tester.getRect(find.byType(KalloSheetHeader));
    final circle = tester.getRect(
      find.descendant(
        of: find.byType(SheetCircleButton),
        matching: find.byType(Container),
      ),
    );
    final capsule = tester.getRect(
      find.descendant(
        of: find.byType(SheetCapsuleButton),
        matching: find.byType(Container),
      ),
    );
    expect(capsule.top, circle.top);
    expect(capsule.height, circle.height);
    expect(header.right - capsule.right, closeTo(kSheetContentInset, 0.5));
    // The title centres on the sheet, level with both controls.
    final title = tester.getRect(find.text('Barcode'));
    expect(title.center.dx, closeTo(header.center.dx, 0.5));
    expect(title.center.dy, closeTo(circle.center.dy, 1));
  });
}
