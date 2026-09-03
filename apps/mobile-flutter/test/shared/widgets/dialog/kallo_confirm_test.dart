import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/actions/confirm_meal_removal.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_confirm.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';
import 'package:kallo_mobile/theme/kallo_motion.dart';

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

/// The fill painted directly behind an action label — the whole point of the
/// two-tier look, so it is read off the render tree rather than restated.
Color _fillBehind(WidgetTester tester, String label) {
  final box = tester.widget<Container>(
    find.ancestor(of: find.text(label), matching: find.byType(Container)).first,
  );
  return (box.decoration! as BoxDecoration).color!;
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
      lessThan(cancel.top),
      reason: 'the two buttons must stack, not sit on one line',
    );
    expect(confirm.center.dx, closeTo(cancel.center.dx, 0.5));
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

  testWidgets('fills the affirmative red only when it destroys something', (
    tester,
  ) async {
    await _open(tester, _host(onResult: (_) {}, destructive: true));
    expect(_fillBehind(tester, 'Xoá'), KalloColors.danger);
    expect(_fillBehind(tester, 'Giữ lại'), const Color(0x00000000));
  });

  testWidgets('a non-destructive affirmative is the beige primary', (
    tester,
  ) async {
    await _open(
      tester,
      _host(onResult: (_) {}, confirmLabel: 'Lưu', cancelLabel: 'Bỏ qua'),
    );
    final fill = _fillBehind(tester, 'Lưu');
    expect(fill, isNot(KalloColors.danger));
    expect(fill, KalloColors.btnPrimarySoft);
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

  testWidgets('both buttons are one height and clear the 44pt tap floor', (
    tester,
  ) async {
    await _open(tester, _host(onResult: (_) {}));
    Rect pill(String label) => tester.getRect(
      find
          .ancestor(of: find.text(label), matching: find.byType(DecoratedBox))
          .first,
    );
    final confirm = pill('Xoá');
    final cancel = pill('Giữ lại');
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

    // Every other quiet button in the app crossfades — a bare Container would
    // put the whole wash on screen in a single frame.
    final animated = tester.widgetList<AnimatedContainer>(
      find.ancestor(
        of: find.text('Giữ lại'),
        matching: find.byType(AnimatedContainer),
      ),
    );
    expect(animated, isNotEmpty);
    expect(animated.first.duration, KalloMotion.press);

    final gesture = await tester.startGesture(
      tester.getCenter(find.text('Giữ lại')),
    );
    await tester.pump();
    await tester.pump(KalloMotion.press ~/ 2);
    final mid = _fillBehind(tester, 'Giữ lại');
    expect(mid, isNot(const Color(0x00000000)), reason: 'it has started');
    expect(mid, isNot(KalloColors.hover), reason: 'and has not finished');

    await gesture.up();
    await tester.pumpAndSettle();
  });
}
