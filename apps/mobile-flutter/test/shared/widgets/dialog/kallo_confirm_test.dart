import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/actions/confirm_meal_removal.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_confirm.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

/// Pumps a screen whose one button opens a confirm and records its answer.
Widget _host({
  required void Function(bool) onResult,
  Future<bool> Function(BuildContext)? open,
  String confirmLabel = 'Xoá',
  String cancelLabel = 'Giữ lại',
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
                            await (open?.call(inner) ??
                                showKalloConfirm(
                                  inner,
                                  title: 'Xoá bữa ăn này?',
                                  description: 'Bữa ăn sẽ biến mất.',
                                  confirmLabel: confirmLabel,
                                  cancelLabel: cancelLabel,
                                  destructive: destructive,
                                )),
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

/// The style a label actually PAINTS with — the merge of the dialog's
/// DefaultTextStyle and the `Text.style`, not either one restated.
TextStyle _painted(WidgetTester tester, String label) => tester
    .widget<RichText>(
      find.descendant(of: find.text(label), matching: find.byType(RichText)),
    )
    .text
    .style!;

/// Every 0.5pt rule currently on screen, read off the render tree.
List<Container> _hairlines() => find
    .byType(Container)
    .evaluate()
    .where((e) => (e.renderObject! as RenderBox).size.height == 0.5)
    .map((e) => e.widget as Container)
    .toList();

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

  testWidgets('opens on the native iOS alert surface', (tester) async {
    await _open(tester, _host(onResult: (_) {}));
    expect(find.byType(CupertinoPopupSurface), findsOneWidget);
    // A system alert is 270 wide; a lookalike that is not reads as a lookalike.
    expect(tester.getSize(find.byType(CupertinoPopupSurface)).width, 270);
  });

  testWidgets('both options are the verbs the caller named', (tester) async {
    await _open(tester, _host(onResult: (_) {}));
    expect(find.text('Xoá'), findsOneWidget);
    expect(find.text('Giữ lại'), findsOneWidget);
    // The pair the API used to default to is gone: neither label may be a
    // generic that makes the user read the title to find out what it does.
    expect(find.text('Đồng ý'), findsNothing);
    expect(find.text('Huỷ'), findsNothing);
  });

  testWidgets('stacks the affirmative above the safe option', (tester) async {
    await _open(tester, _host(onResult: (_) {}));
    final confirm = tester.getRect(find.text('Xoá'));
    final cancel = tester.getRect(find.text('Giữ lại'));
    expect(
      confirm.bottom,
      lessThanOrEqualTo(cancel.top),
      reason: 'the two actions must stack, not sit on one line',
    );
    expect(confirm.center.dx, closeTo(cancel.center.dx, 0.5));
  });

  testWidgets('the action rows are full-width and share their edges', (
    tester,
  ) async {
    await _open(tester, _host(onResult: (_) {}));
    Rect row(String label) => tester.getRect(
      find
          .ancestor(
            of: find.text(label),
            matching: find.byType(AnimatedContainer),
          )
          .first,
    );
    final confirm = row('Xoá');
    final cancel = row('Giữ lại');
    expect(confirm.left, closeTo(cancel.left, 0.01));
    expect(confirm.right, closeTo(cancel.right, 0.01));
    // Full-bleed: the hairlines reach both edges of the 270pt card.
    expect(confirm.width, 270);
    // The iOS action row floor, which is also the tap-target floor.
    expect(confirm.height, greaterThanOrEqualTo(44));
    expect(cancel.height, greaterThanOrEqualTo(44));
  });

  testWidgets('divides the anatomy with 0.5pt hairlines', (tester) async {
    await _open(tester, _host(onResult: (_) {}));
    final rules = _hairlines();
    expect(
      rules.length,
      greaterThanOrEqualTo(2),
      reason: 'one above each action row',
    );
    expect(rules.first.color, kHairline);
  });

  testWidgets('paints the destructive verb red and semibold', (tester) async {
    await _open(tester, _host(onResult: (_) {}, destructive: true));
    final confirm = _painted(tester, 'Xoá');
    expect(confirm.color, KalloColors.danger);
    expect(confirm.fontWeight, FontWeight.w600);
    // No fill anywhere behind it — the pills are retired.
    final wash = tester
        .widget<AnimatedContainer>(
          find
              .ancestor(
                of: find.text('Xoá'),
                matching: find.byType(AnimatedContainer),
              )
              .first,
        )
        .decoration;
    expect((wash! as BoxDecoration).color, const Color(0x00000000));
  });

  testWidgets('the safe option is regular ink', (tester) async {
    await _open(tester, _host(onResult: (_) {}, destructive: true));
    final cancel = _painted(tester, 'Giữ lại');
    expect(cancel.color, kInk);
    expect(cancel.fontWeight, FontWeight.w400);
  });

  testWidgets('a non-destructive affirmative is ink, not red', (tester) async {
    await _open(
      tester,
      _host(onResult: (_) {}, confirmLabel: 'Lưu', cancelLabel: 'Bỏ qua'),
    );
    final confirm = _painted(tester, 'Lưu');
    expect(confirm.color, isNot(KalloColors.danger));
    expect(confirm.color, kInk);
    expect(confirm.fontWeight, FontWeight.w600);
  });

  testWidgets('no yellow error underline leaks onto the text', (tester) async {
    await _open(tester, _host(onResult: (_) {}));
    // Outside a Material, WidgetsApp's fallback DefaultTextStyle is the
    // red/double-yellow-underline error style and `Text.style` merges ONTO it.
    for (final label in ['Xoá bữa ăn này?', 'Bữa ăn sẽ biến mất.', 'Xoá']) {
      expect(
        _painted(tester, label).decoration,
        TextDecoration.none,
        reason: '$label must not inherit the error style',
      );
    }
  });

  testWidgets('centres the title and the description', (tester) async {
    await _open(tester, _host(onResult: (_) {}));
    final card = tester.getRect(find.byType(CupertinoPopupSurface));
    expect(
      tester.getRect(find.text('Xoá bữa ăn này?')).center.dx,
      closeTo(card.center.dx, 0.5),
    );
    expect(
      tester.getRect(find.text('Bữa ăn sẽ biến mất.')).center.dx,
      closeTo(card.center.dx, 0.5),
    );
  });

  testWidgets('answers true only for the affirmative', (tester) async {
    bool? answer;
    await _open(tester, _host(onResult: (v) => answer = v));
    await tester.tap(find.text('Xoá'));
    await tester.pumpAndSettle();
    expect(answer, isTrue);
  });

  testWidgets('answers false for the safe option', (tester) async {
    bool? answer;
    await _open(tester, _host(onResult: (v) => answer = v));
    await tester.tap(find.text('Giữ lại'));
    await tester.pumpAndSettle();
    expect(answer, isFalse);
  });

  testWidgets('answers false when the barrier is tapped', (tester) async {
    bool? answer;
    await _open(tester, _host(onResult: (v) => answer = v));
    // Top-left corner is scrim, never the 270pt card.
    await tester.tapAt(const Offset(4, 4));
    await tester.pumpAndSettle();
    expect(answer, isFalse, reason: 'dismissing must never read as consent');
  });

  testWidgets('confirmMealRemoval names Remove against Keep', (tester) async {
    await _open(tester, _host(onResult: (_) {}, open: confirmMealRemoval));
    expect(find.text(tr('common.actions.remove')), findsOneWidget);
    expect(find.text(tr('common.actions.keep')), findsOneWidget);
    expect(find.text(tr('logging.removeConfirmTitle')), findsOneWidget);
  });

  testWidgets('confirmPendingDiscard names Discard against Keep', (
    tester,
  ) async {
    await _open(tester, _host(onResult: (_) {}, open: confirmPendingDiscard));
    expect(find.text(tr('common.actions.discard')), findsOneWidget);
    expect(find.text(tr('common.actions.keep')), findsOneWidget);
  });

  testWidgets('fits a small phone at the Dynamic Type cap', (tester) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
        child: _host(
          onResult: (_) {},
          confirmLabel: 'Ngắt kết nối',
          cancelLabel: 'Giữ lại',
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(tester.getRect(find.text('Giữ lại')).bottom, lessThan(568));
  });
}
