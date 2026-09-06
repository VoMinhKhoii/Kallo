import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet_header.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import '../l10n_test_loader.dart';

/// The sheet chrome every sheet inherits: a grabber saying the surface can be
/// dragged, and a close X that starts on the sheet's own content inset.
Widget _app() => EasyLocalization(
      supportedLocales: const [Locale('en')],
      path: 'assets/l10n',
      fallbackLocale: const Locale('en'),
      assetLoader: const FsL10nLoader(),
      child: Builder(
        builder: (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          home: const Scaffold(
            body: KalloSheetSurface(
              child: KalloSheetHeader(title: 'Log weight'),
            ),
          ),
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

  testWidgets('the header carries a grabber above the title row',
      (tester) async {
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
    expect(barRect.top - header.top, closeTo(KalloSpacing.sp2, 0.5),
        reason: 'the grabber sits ~8pt off the sheet top');
    expect(barRect.bottom, lessThan(title.top),
        reason: 'the grabber sits ABOVE the title row');
    expect(barRect.center.dx, closeTo(header.center.dx, 0.5),
        reason: 'the grabber is centred');
  });

  testWidgets('the close X starts on the sheet\'s 16pt content inset',
      (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    final header = tester.getRect(find.byType(KalloSheetHeader));
    final glyph = tester.getRect(find.byIcon(LucideIcons.x300));

    // The GLYPH, not its tap target, is what the eye lines up against the
    // sheet's body. It used to sit 8pt of padding plus IconButton's own 48pt
    // centring — 32pt in, level with nothing.
    expect(glyph.left - header.left, closeTo(KalloSpacing.sp4, 0.5),
        reason: 'the X must start on the content inset');

    // The target still honours 44pt, by extending inward rather than by
    // pushing the glyph in.
    final target = tester.getSize(find.byType(IconButton));
    expect(target.width, greaterThanOrEqualTo(44));
    expect(target.height, greaterThanOrEqualTo(44));
  });
}
