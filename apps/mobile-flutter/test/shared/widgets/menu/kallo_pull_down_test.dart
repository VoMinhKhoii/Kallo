import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/menu/kallo_pull_down.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../l10n_test_loader.dart';

/// The pull-down form of the app's menu: the button shows the current value
/// and the up-down chevrons, the menu ticks the current choice, and only a
/// DIFFERENT pick is reported.
const _options = [
  KalloPullDownOption(value: 'serving', label: 'Serving', detail: '100 ml'),
  KalloPullDownOption(value: 'pack', label: 'Pack', detail: '1 L'),
  KalloPullDownOption(value: 'custom', label: 'Custom'),
];

Widget _app({
  required String value,
  required List<String> changes,
  List<KalloPullDownOption<String>> options = _options,
}) => EasyLocalization(
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
          home: Scaffold(
            body: Center(
              child: KalloPullDown<String>(
                value: value,
                display: '100 ml / serving',
                options: options,
                onChanged: changes.add,
                semanticLabel: 'Portion',
              ),
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

  testWidgets('shows the value and opens the menu with the choice ticked', (
    tester,
  ) async {
    final changes = <String>[];
    await tester.pumpWidget(_app(value: 'serving', changes: changes));
    await tester.pumpAndSettle();

    expect(find.text('100 ml / serving'), findsOneWidget);
    expect(find.byIcon(LucideIcons.chevronsUpDown300), findsOneWidget);

    await tester.tap(find.text('100 ml / serving'));
    await tester.pumpAndSettle();

    for (final o in _options) {
      expect(find.text(o.label), findsOneWidget);
    }
    expect(find.text('100 ml'), findsOneWidget);
    expect(find.text('1 L'), findsOneWidget);
    // Exactly one tick, on the current choice's row.
    expect(find.byIcon(LucideIcons.check300), findsOneWidget);
    final tick = tester.getCenter(find.byIcon(LucideIcons.check300));
    final serving = tester.getCenter(find.text('Serving'));
    expect(tick.dy, closeTo(serving.dy, 1));
  });

  testWidgets('a different pick is reported, the same pick is not', (
    tester,
  ) async {
    final changes = <String>[];
    await tester.pumpWidget(_app(value: 'serving', changes: changes));
    await tester.pumpAndSettle();

    await tester.tap(find.text('100 ml / serving'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Serving'));
    await tester.pumpAndSettle();
    expect(
      changes,
      isEmpty,
      reason: 're-picking the current choice is a no-op',
    );

    await tester.tap(find.text('100 ml / serving'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pack'));
    await tester.pumpAndSettle();
    expect(changes, ['pack']);
  });

  testWidgets('a single option is a plain value, not a menu', (tester) async {
    final changes = <String>[];
    await tester.pumpWidget(
      _app(value: 'custom', changes: changes, options: [_options.last]),
    );
    await tester.pumpAndSettle();

    expect(find.byIcon(LucideIcons.chevronsUpDown300), findsNothing);
    await tester.tap(find.text('100 ml / serving'));
    await tester.pumpAndSettle();
    expect(find.text('Custom'), findsNothing, reason: 'no menu opened');
  });

  testWidgets('the page under a pull-down stays sharp: no blur, no dim', (
    tester,
  ) async {
    await tester.pumpWidget(_app(value: 'serving', changes: []));
    await tester.pumpAndSettle();

    await tester.tap(find.text('100 ml / serving'));
    await tester.pumpAndSettle();

    expect(find.text('Pack'), findsOneWidget, reason: 'the menu is open');
    expect(
      find.byType(BackdropFilter),
      findsNothing,
      reason: 'a context menu recedes the page; a pull-down does not',
    );
  });
}
