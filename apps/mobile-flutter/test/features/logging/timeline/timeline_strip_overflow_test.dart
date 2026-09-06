import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/logging_spacing.dart';
import 'package:kallo_mobile/features/logging/widgets/timeline/timeline_picker.dart';
import 'package:kallo_mobile/features/logging/widgets/timeline/timeline_strip.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

const _today = '2026-08-25';
const _dates = ['2026-08-19', '2026-08-24', '2026-08-25'];

/// The expanded week strip, at a given Dynamic Type scale.
Widget _app(double textScale) => ProviderScope(
  child: EasyLocalization(
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
            home: MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
              child: Scaffold(
                body: DateMorph(
                  dates: _dates,
                  today: _today,
                  selectedDate: _today,
                  expanded: true,
                  onSelectDate: (_) {},
                  onExpand: () {},
                  onCollapse: () {},
                ),
              ),
            ),
          ),
    ),
  ),
);

/// `LoggingSpacing.strip` is ONE number for both morph layers and is derived
/// by hand from the day cell's stack (weekday Meta + day number Body + dot +
/// gaps + padding). Every type-ramp change so far has moved that sum, and the
/// 2026-09-01 ramp overflowed the strip by 4pt before anyone noticed on
/// device. This pins the arithmetic: the expanded strip must lay out without
/// a RenderFlex overflow at 1.0x and at the app's 1.3x text-scale ceiling.
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

  for (final scale in [1.0, 1.3]) {
    testWidgets('the expanded week strip fits its ${scale}x day cells', (
      tester,
    ) async {
      await tester.pumpWidget(_app(scale));
      await tester.pumpAndSettle();

      expect(find.byType(TimelineStrip), findsOneWidget);
      expect(
        tester.takeException(),
        isNull,
        reason: 'a day cell overflowed LoggingSpacing.stripFor '
            '(${LoggingSpacing.strip} at 1.0x) at ${scale}x',
      );
    });
  }
}
