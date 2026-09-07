import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/dialog/kallo_confirm.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_confirm_actions.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

/// The contract for a held alert action, which is the platform's own: the wash
/// lasts the ENTIRE hold, however long the finger stays down, and the action
/// FIRES on release (mobile.md, "Platform — Cupertino wherever it exists",
/// boundary 2 — the platform wins on behaviour).
///
/// Two regressions live here. The wash used to vanish mid-hold: the row
/// registered a long press, so at ~500ms that recognizer won the arena, the tap
/// recognizer was REJECTED, and its `onTapCancel` cleared `_pressed` with the
/// finger still down — the 1500ms assertion below is the guard, in the one
/// place a competing long-press recognizer actually exists (the primitive's
/// own test, `surface/kallo_pressable_test.dart`, covers the rest of the
/// press contract). And the same long press swallowed the tap, so a hold
/// committed nothing; the release assertions are the guard for that.
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

  Color washOf(WidgetTester tester, String label) {
    final box = tester.widget<AnimatedContainer>(
      find
          .ancestor(
            of: find.text(label),
            matching: find.byType(AnimatedContainer),
          )
          .first,
    );
    // AnimatedContainer(color:) is folded into `decoration` at construction.
    return (box.decoration as BoxDecoration?)?.color ?? const Color(0x00000000);
  }

  testWidgets('a held action stays washed until the finger lifts, then fires', (
    tester,
  ) async {
    bool? answer;
    await tester.pumpWidget(
      EasyLocalization(
        supportedLocales: const [Locale('vi')],
        startLocale: const Locale('vi'),
        path: 'assets/l10n',
        fallbackLocale: const Locale('vi'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder: (context) => MaterialApp(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            home: Scaffold(
              body: Builder(
                builder: (inner) => Center(
                  child: ElevatedButton(
                    onPressed: () async => answer = await showKalloConfirm(
                      inner,
                      title: 'Xoá bữa ăn này?',
                      confirmLabel: 'Xoá',
                      cancelLabel: 'Giữ lại',
                      destructive: true,
                    ),
                    child: const Text('open'),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.byType(KalloAlertAction), findsNWidgets(2));

    final gesture = await tester.startGesture(
      tester.getCenter(find.text('Xoá')),
    );
    // Well past the 500ms long-press threshold, finger still down.
    await tester.pump(const Duration(milliseconds: 1500));
    expect(
      washOf(tester, 'Xoá'),
      KalloColors.pressWash,
      reason: 'the wash cleared while the finger was still down — '
          'the long-press win rejected the tap and its cancel wiped the state',
    );

    await gesture.up();
    await tester.pumpAndSettle();
    // Release fires the action, exactly as an iOS alert action does: the
    // dialog is gone, and the affirmative answered true.
    expect(
      find.byType(KalloAlertAction),
      findsNothing,
      reason: 'releasing a hold must fire the action and close the dialog',
    );
    expect(answer, isTrue, reason: 'the affirmative must answer true');
  });
}
