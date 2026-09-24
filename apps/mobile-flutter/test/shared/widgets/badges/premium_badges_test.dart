import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/badges/premium_chip.dart';
import 'package:kallo_mobile/shared/widgets/badges/premium_dot.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

import '../../../l10n_test_loader.dart';

/// The approved round-6 spec for both Premium markers: the soft-blue chip and
/// the icon-corner dot.
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

  Future<void> pump(WidgetTester tester, Widget child) async {
    await tester.pumpWidget(
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
                home: Scaffold(body: Center(child: child)),
              ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('chip: 18pt soft-blue pill reading "Premium" at 11/600', (
    tester,
  ) async {
    await pump(tester, const PremiumChip());

    final label = tester.widget<Text>(find.text('Premium'));
    expect(label.style!.fontSize, 11);
    expect(label.style!.fontWeight, FontWeight.w600);
    expect(label.style!.color, KalloColors.premiumChipText);
    expect(label.style!.color, const Color(0xFF2F5FD0));

    expect(tester.getSize(find.byType(PremiumChip)).height, 18);
    final box =
        tester
                .widget<Container>(
                  find.descendant(
                    of: find.byType(PremiumChip),
                    matching: find.byType(Container),
                  ),
                )
                .decoration!
            as BoxDecoration;
    expect(box.color, const Color(0xFFF5F8FE));
    expect((box.border! as Border).top.color, const Color(0xFFA9C1F0));
    expect((box.border! as Border).top.width, 1);
  });

  testWidgets('dot: a 7pt blue dot in a 2pt white ring when shown', (
    tester,
  ) async {
    await pump(
      tester,
      const PremiumDot(show: true, child: Icon(Icons.refresh, size: 24)),
    );

    final dot = find.byKey(const ValueKey('premium-dot'));
    expect(dot, findsOneWidget);
    // 7 of blue plus the ring on both sides.
    expect(tester.getSize(dot), const Size(11, 11));
    final box = tester.widget<Container>(dot).decoration! as BoxDecoration;
    expect(box.color, const Color(0xFF3B6FE0));
    expect(box.shape, BoxShape.circle);
    expect((box.border! as Border).top.width, 2);
    expect((box.border! as Border).top.color, KalloColors.elev);

    // It sits on the glyph's top-right corner.
    final icon = tester.getRect(find.byIcon(Icons.refresh));
    final ring = tester.getRect(dot);
    expect(ring.right, closeTo(icon.right + 2, 0.01));
    expect(ring.top, closeTo(icon.top - 2, 0.01));
  });

  testWidgets('dot: hidden, the child renders untouched', (tester) async {
    await pump(
      tester,
      const PremiumDot(show: false, child: Icon(Icons.refresh, size: 24)),
    );

    expect(find.byKey(const ValueKey('premium-dot')), findsNothing);
    expect(find.byIcon(Icons.refresh), findsOneWidget);
  });
}
