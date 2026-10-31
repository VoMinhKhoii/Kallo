import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/actions/confirm_meal_removal.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_alert_surface.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_confirm.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_confirm_actions.dart';
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
TextStyle _painted(WidgetTester tester, String label) =>
    tester
        .widget<RichText>(
          find.descendant(
            of: find.text(label),
            matching: find.byType(RichText),
          ),
        )
        .text
        .style!;

/// An iPhone 17 Pro sized screen (402pt), or [width] wide.
void _phone(WidgetTester tester, {double width = 402}) {
  tester.view.physicalSize = Size(width, 874);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

/// The pill carrying [label].
Finder _pill(String label) =>
    find.ancestor(of: find.text(label), matching: find.byType(ClipRRect));

/// The colour [label]'s pill is filled with.
Color _fill(WidgetTester tester, String label) =>
    tester
        .widget<ColoredBox>(
          find
              .ancestor(of: find.text(label), matching: find.byType(ColoredBox))
              .first,
        )
        .color;

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

  testWidgets('opens on the iOS 26 alert card: 318pt, centred', (tester) async {
    // iPhone 17 Pro, where the iOS 26.3 system alert measured 318pt.
    _phone(tester);
    await _open(tester, _host(onResult: (_) {}));
    final card = tester.getRect(find.byKey(kKalloConfirmSurface));
    expect(card.width, kKalloAlertMaxWidth);
    expect(card.center.dx, closeTo(201, 0.5));
  });

  testWidgets('on a narrow phone the card keeps 20pt either side', (
    tester,
  ) async {
    _phone(tester, width: 320);
    await _open(tester, _host(onResult: (_) {}));
    expect(tester.getSize(find.byKey(kKalloConfirmSurface)).width, 280);
  });

  testWidgets('comes in from 1.08x as it fades, leaves without shrinking', (
    tester,
  ) async {
    _phone(tester);
    await tester.pumpWidget(_host(onResult: (_) {}));
    await tester.pumpAndSettle();
    await tester.tap(find.text('open'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));

    final card = find.byKey(kKalloConfirmSurface);
    FadeTransition fade() => tester.widget<FadeTransition>(
      find.ancestor(of: card, matching: find.byType(FadeTransition)).first,
    );
    ScaleTransition scale() => tester.widget<ScaleTransition>(
      find.ancestor(of: card, matching: find.byType(ScaleTransition)).first,
    );
    // Mid-entrance: still a little large, partly opaque.
    expect(scale().scale.value, inExclusiveRange(1, kKalloAlertEnterScale));
    expect(fade().opacity.value, inExclusiveRange(0, 1));

    await tester.pump(kKalloAlertFade);
    expect(scale().scale.value, 1);
    expect(fade().opacity.value, 1);

    // Out: no shrink, and the card is gone well before the dim is.
    await tester.tap(find.text('Giữ lại'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 110));
    expect(scale().scale.value, 1);
    expect(fade().opacity.value, 0);
    await tester.pump(kKalloAlertFade);
    expect(card, findsNothing);
  });

  testWidgets('the card is SOLID white, never a frosted surface', (
    tester,
  ) async {
    // It was a CupertinoPopupSurface: ~80% opaque over a backdrop blur, the
    // one see-through surface in an app whose design system opens by naming
    // solid surfaces. A translucent card is also what made a pressed action
    // row look like a glitch.
    await _open(tester, _host(onResult: (_) {}));
    final fill = tester.widget<ColoredBox>(
      find
          .descendant(
            of: find.byKey(kKalloConfirmSurface),
            matching: find.byType(ColoredBox),
          )
          .first,
    );
    expect(fill.color, kCardSurface);
    expect(fill.color.a, 1.0, reason: 'the card must not be translucent');
    expect(find.byType(BackdropFilter), findsNothing);
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

  testWidgets('VoiceOver reads each verb once, as a tappable button', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await _open(tester, _host(onResult: (_) {}));
    for (final verb in ['Xoá', 'Giữ lại']) {
      expect(
        tester.getSemantics(find.bySemanticsLabel(verb)),
        matchesSemantics(label: verb, isButton: true, hasTapAction: true),
      );
    }
    semantics.dispose();
  });

  testWidgets('two short verbs sit side by side, the cancel on the left', (
    tester,
  ) async {
    _phone(tester);
    await _open(tester, _host(onResult: (_) {}));
    final confirm = tester.getRect(_pill('Xoá'));
    final cancel = tester.getRect(_pill('Giữ lại'));
    expect(confirm.top, closeTo(cancel.top, 0.01));
    expect(cancel.right, lessThan(confirm.left));
    expect(confirm.width, closeTo(cancel.width, 0.01));
    expect(confirm.height, kKalloAlertActionHeight);
  });

  testWidgets('a verb too long for half the row stacks them, answer on top', (
    tester,
  ) async {
    _phone(tester);
    await _open(
      tester,
      _host(
        onResult: (_) {},
        confirmLabel: "That's everything I ate",
        cancelLabel: 'Not now',
      ),
    );
    final card = tester.getRect(find.byKey(kKalloConfirmSurface));
    final confirm = tester.getRect(_pill("That's everything I ate"));
    final cancel = tester.getRect(_pill('Not now'));
    expect(confirm.bottom + kKalloAlertActionGap, closeTo(cancel.top, 0.01));
    // Full width inside the card's 15pt pill inset.
    expect(confirm.left - card.left, kKalloAlertActionInset);
    expect(card.right - confirm.right, kKalloAlertActionInset);
    expect(card.bottom - cancel.bottom, kKalloAlertActionInset);
  });

  testWidgets('a non-destructive answer is a filled blue pill, white label', (
    tester,
  ) async {
    await _open(
      tester,
      _host(onResult: (_) {}, confirmLabel: 'Lưu', cancelLabel: 'Bỏ qua'),
    );
    expect(_fill(tester, 'Lưu'), const Color(0xFF0088FF));
    expect(_painted(tester, 'Lưu').color, const Color(0xFFFFFFFF));
    // The cancel: ink on the grey pill.
    expect(_fill(tester, 'Bỏ qua'), kAlertPillFill);
    expect(_painted(tester, 'Bỏ qua').color, kInk);
  });

  testWidgets('a destructive answer is red on grey, never a red fill', (
    tester,
  ) async {
    await _open(tester, _host(onResult: (_) {}, destructive: true));
    expect(_fill(tester, 'Xoá'), kAlertPillFill);
    expect(_painted(tester, 'Xoá').color, KalloColors.danger);
    expect(_painted(tester, 'Giữ lại').color, kInk);
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

  testWidgets('left-aligns the title and the message, 30pt in', (tester) async {
    _phone(tester);
    await _open(tester, _host(onResult: (_) {}));
    final card = tester.getRect(find.byKey(kKalloConfirmSurface));
    for (final text in ['Xoá bữa ăn này?', 'Bữa ăn sẽ biến mất.']) {
      expect(
        tester.getRect(find.text(text)).left - card.left,
        kKalloAlertTextInset,
      );
    }
    expect(_painted(tester, 'Bữa ăn sẽ biến mất.').color, kInkMuted);
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
    // Top-left corner is scrim, never the card (20pt in from every edge).
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
