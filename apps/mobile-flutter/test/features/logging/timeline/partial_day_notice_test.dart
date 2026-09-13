import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/timeline/partial_day_notice.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

Widget _host({
  required VoidCallback onMarkComplete,
  required VoidCallback onDismiss,
}) => EasyLocalization(
  supportedLocales: const [Locale('en'), Locale('vi')],
  startLocale: const Locale('vi'),
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder:
        (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          home: Scaffold(
            body: PartialDayNotice(
              calories: 1170,
              target: 1980,
              onDismiss: onDismiss,
              onMarkComplete: onMarkComplete,
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
    await loadAppFonts();
  });

  testWidgets('offers the attestation alongside the figures', (tester) async {
    await tester.pumpWidget(_host(onMarkComplete: () {}, onDismiss: () {}));
    await tester.pumpAndSettle();

    expect(find.text('Ngày này có thể ghi chưa đủ'), findsOneWidget);
    expect(find.text('Mình ăn đủ rồi'), findsOneWidget);
    expect(find.textContaining('1.170'), findsOneWidget);
    expect(find.textContaining('1.980'), findsOneWidget);
  });

  testWidgets('reports the mark tap without dismissing', (tester) async {
    var marked = 0;
    var dismissed = 0;
    await tester.pumpWidget(
      _host(onMarkComplete: () => marked++, onDismiss: () => dismissed++),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Mình ăn đủ rồi'));
    await tester.pumpAndSettle();

    expect(marked, 1);
    // The two exits are distinct: attesting is not dismissing, and the widget
    // must not fire both from one tap.
    expect(dismissed, 0);
  });

  // The block's only action, so it runs the full width of the band on the
  // full-round token rather than hugging its label and leaving a ragged edge.
  testWidgets('draws the action as a full-width pill', (tester) async {
    await tester.pumpWidget(_host(onMarkComplete: () {}, onDismiss: () {}));
    await tester.pumpAndSettle();

    final button = tester.widget<Container>(
      find
          .ancestor(
            of: find.text('Mình ăn đủ rồi'),
            matching: find.byType(Container),
          )
          .first,
    );
    final decoration = button.decoration as BoxDecoration;
    expect(
      decoration.borderRadius,
      BorderRadius.circular(KalloRadii.button),
      reason: 'the full-round token, not the 12pt buttonXl',
    );

    // Measured, not just declared: `width: double.infinity` leaves
    // constraints.maxWidth at infinity either way, so only the laid-out size
    // tells a full-width capsule from one hugging its label.
    final band = tester.getSize(find.byType(PartialDayNotice)).width;
    final capsule = tester.getSize(find.byType(Container).at(1)).width;
    expect(capsule, lessThan(band), reason: 'inset by the band padding');
    expect(capsule, greaterThan(band * 0.8), reason: 'but otherwise the width');
  });

  // Weight is reserved for titles in this token set (calm_tokens.dart): the
  // heading carries it, the action label does not.
  testWidgets('emphasises the title, not the action label', (tester) async {
    await tester.pumpWidget(_host(onMarkComplete: () {}, onDismiss: () {}));
    await tester.pumpAndSettle();

    final title = tester.widget<Text>(find.text('Ngày này có thể ghi chưa đủ'));
    final label = tester.widget<Text>(find.text('Mình ăn đủ rồi'));

    expect(title.style?.fontWeight, FontWeight.w600);
    expect(label.style?.fontWeight, FontWeight.w400);
  });

  // The muted ink token was lightened to #7A7870 on 2026-09-02, which drops
  // white copy on this band to 4.44:1 — under AA. bandSurface is pinned at the
  // pre-lightening value precisely so this band cannot follow it.
  testWidgets('paints the band on bandSurface, not the muted ink token', (
    tester,
  ) async {
    await tester.pumpWidget(_host(onMarkComplete: () {}, onDismiss: () {}));
    await tester.pumpAndSettle();

    final container = tester.widget<Container>(
      find
          .descendant(
            of: find.byType(PartialDayNotice),
            matching: find.byType(Container),
          )
          .first,
    );
    final decoration = container.decoration as BoxDecoration;
    expect(decoration.color, KalloColors.bandSurface);
    expect(decoration.color, isNot(KalloColors.textMuted));
  });
}
