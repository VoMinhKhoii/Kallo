import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/dialog/kallo_confirm.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';
import 'package:kallo_mobile/theme/kallo_motion.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

/// Pumps a screen whose one button opens the confirm and records its answer.
Widget _host({
  required void Function(bool) onResult,
  String? confirmLabel,
  bool destructive = false,
  Locale locale = const Locale('vi'),
}) => EasyLocalization(
  supportedLocales: const [Locale('en'), Locale('vi')],
  startLocale: locale,
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
            body: Builder(
              builder:
                  (inner) => Center(
                    child: ElevatedButton(
                      onPressed:
                          () async => onResult(
                            await showKalloConfirm(
                              inner,
                              title: 'Xoá bữa ăn này?',
                              description: 'Bữa ăn sẽ biến mất.',
                              confirmLabel: confirmLabel,
                              destructive: destructive,
                            ),
                          ),
                      child: const Text('open'),
                    ),
                  ),
            ),
          ),
        ),
  ),
);

Future<void> _open(WidgetTester tester, Widget host) async {
  await tester.pumpWidget(host);
  // EasyLocalization loads its bundle asynchronously; nothing is on screen
  // until that settles.
  await tester.pumpAndSettle();
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

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

  testWidgets('defaults to the two neutral labels', (tester) async {
    await _open(tester, _host(onResult: (_) {}));
    // The whole point of the report: neither button is a verb that could be
    // read as the other one.
    expect(find.text('Đồng ý'), findsOneWidget);
    expect(find.text('Huỷ'), findsOneWidget);
  });

  testWidgets('stacks the affirmative above the cancel', (tester) async {
    await _open(tester, _host(onResult: (_) {}));
    final confirm = tester.getRect(find.text('Đồng ý'));
    final cancel = tester.getRect(find.text('Huỷ'));
    expect(
      confirm.bottom,
      lessThan(cancel.top),
      reason: 'the two buttons must stack, not sit on one line',
    );
    // Full-width, so neither can be mistaken for the other by size.
    expect(confirm.center.dx, closeTo(cancel.center.dx, 0.5));
  });

  testWidgets('centres the title and the description', (tester) async {
    await _open(tester, _host(onResult: (_) {}));
    final title = tester.getRect(find.text('Xoá bữa ăn này?'));
    final body = tester.getRect(find.text('Bữa ăn sẽ biến mất.'));
    final dialog = tester.getRect(find.byType(Dialog));
    expect(title.center.dx, closeTo(dialog.center.dx, 0.5));
    expect(body.center.dx, closeTo(dialog.center.dx, 0.5));
  });

  testWidgets('answers true only for the affirmative', (tester) async {
    bool? answer;
    await _open(tester, _host(onResult: (v) => answer = v));
    await tester.tap(find.text('Đồng ý'));
    await tester.pumpAndSettle();
    expect(answer, isTrue);
  });

  testWidgets('answers false for cancel', (tester) async {
    bool? answer;
    await _open(tester, _host(onResult: (v) => answer = v));
    await tester.tap(find.text('Huỷ'));
    await tester.pumpAndSettle();
    expect(answer, isFalse);
  });

  testWidgets('answers false when the barrier is tapped', (tester) async {
    bool? answer;
    await _open(tester, _host(onResult: (v) => answer = v));
    // Top-left corner is scrim, never the card.
    await tester.tapAt(const Offset(4, 4));
    await tester.pumpAndSettle();
    expect(
      answer,
      isFalse,
      reason: 'dismissing must never read as consent',
    );
  });

  testWidgets('paints the affirmative red only when destructive', (
    tester,
  ) async {
    await _open(tester, _host(onResult: (_) {}, destructive: true));
    Color fillBehind(String label) {
      final box = tester.widget<Container>(
        find
            .ancestor(of: find.text(label), matching: find.byType(Container))
            .first,
      );
      return (box.decoration! as BoxDecoration).color!;
    }

    expect(fillBehind('Đồng ý'), KalloColors.danger);
    expect(fillBehind('Huỷ'), Colors.transparent);
  });

  testWidgets('keeps a distinct verb when one is given', (tester) async {
    await _open(tester, _host(onResult: (_) {}, confirmLabel: 'Rời nhóm'));
    // Not every confirm is ambiguous — "Rời nhóm" beside "Huỷ" is two clearly
    // different things, so the caller may keep its verb.
    expect(find.text('Rời nhóm'), findsOneWidget);
    expect(find.text('Đồng ý'), findsNothing);
  });

  testWidgets('fits a small phone at the Dynamic Type cap', (tester) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
        child: _host(onResult: (_) {}),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(tester.getRect(find.text('Huỷ')).bottom, lessThan(568));
  });

  testWidgets('the two buttons are one height, and both clear the tap floor', (
    tester,
  ) async {
    await _open(tester, _host(onResult: (_) {}));

    // Read the rendered pills rather than restating their padding, so this
    // fails on the drift itself. Both numbers matter: the buttons used to be
    // the only ones in the app propped up by a minHeight, and taking that away
    // is only safe while the padding alone still clears 44.
    final confirm = tester.getRect(
      find.ancestor(
        of: find.text('Đồng ý'),
        matching: find.byType(DecoratedBox),
      ).first,
    );
    final cancel = tester.getRect(
      find.ancestor(
        of: find.text('Huỷ'),
        matching: find.byType(DecoratedBox),
      ).first,
    );

    expect(
      confirm.height,
      closeTo(cancel.height, 0.5),
      reason: 'a stacked pair reads as one control; two heights reads as a bug',
    );
    expect(confirm.height, greaterThanOrEqualTo(44));
  });

  testWidgets('the cancel fades its wash in rather than snapping it', (
    tester,
  ) async {
    await _open(tester, _host(onResult: (_) {}));

    // Every other quiet button in the app crossfades — this one was a bare
    // Container, so the wash appeared in one frame.
    final animated = tester.widgetList<AnimatedContainer>(
      find.ancestor(
        of: find.text('Huỷ'),
        matching: find.byType(AnimatedContainer),
      ),
    );
    expect(animated, isNotEmpty);
    expect(animated.first.duration, KalloMotion.press);
  });
}
