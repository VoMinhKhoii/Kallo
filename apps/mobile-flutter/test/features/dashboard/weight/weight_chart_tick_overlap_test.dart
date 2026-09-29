import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/logic/weight_chart_axis.dart';
import 'package:kallo_mobile/features/dashboard/widgets/weight/weight_chart_canvas.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

/// Seen on device (vi, 30-day range): the last date tick ran into the "Now"
/// label and the row read "16/9Hiện tại".
///
/// The tick thinning budgeted an equal slot per label, but the date row does
/// not draw them evenly: `fitInside` pulls "Now" wholly left of its tick, whole
/// days make the last gap short, and a forecast tail packs every tick into the
/// left of the plot. So this measures what is DRAWN, across the series shapes,
/// widths, languages and text scales the card meets.
final _dateRowLabel = RegExp(r'^(\d+/\d+|Now|Start|Hiện tại|Bắt đầu)$');

final _firstDay = DateTime.utc(2026, 8, 18);

String _iso(int offset) =>
    _firstDay.add(Duration(days: offset)).toIso8601String().substring(0, 10);

Widget _app(Locale locale, double width, TextScaler scaler, Widget child) =>
    EasyLocalization(
      // Keyed by locale: without it the second locale reuses the first's state.
      key: ValueKey(locale),
      supportedLocales: const [Locale('en'), Locale('vi')],
      path: 'assets/l10n',
      startLocale: locale,
      fallbackLocale: const Locale('en'),
      assetLoader: const FsL10nLoader(),
      child: Builder(
        builder:
            (context) => MaterialApp(
              localizationsDelegates: context.localizationDelegates,
              supportedLocales: context.supportedLocales,
              locale: context.locale,
              home: MediaQuery(
                data: MediaQuery.of(context).copyWith(textScaler: scaler),
                child: Scaffold(
                  body: Center(child: SizedBox(width: width, child: child)),
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
    // Label widths are the whole question; the placeholder font would lie.
    await loadAppFonts();
  });

  for (final locale in const [Locale('vi'), Locale('en')]) {
    for (final scale in const [1.0, 1.3]) {
      testWidgets('no two date labels touch — $locale at ${scale}x', (
        tester,
      ) async {
        tester.view.physicalSize = const Size(430, 1200);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        final collisions = <String>[];
        // 320: the narrowest card; 334: a 390pt phone; 358: a 414pt one.
        for (final width in const [320.0, 334.0, 358.0]) {
          for (final project in const [false, true]) {
            // Every span a 30-day window can have, a reading every 3 days.
            for (var span = 3; span <= 29; span++) {
              final offsets = [for (var d = 0; d < span; d += 3) d, span];
              await tester.pumpWidget(
                _app(
                  locale,
                  width,
                  TextScaler.linear(scale),
                  WeightChartCanvas(
                    key: UniqueKey(),
                    weights: [for (final o in offsets) 72 - o * 0.05],
                    weightDates: [for (final o in offsets) _iso(o)],
                    periodElapsedDays: span + 1,
                    projectedEndWeight: 70,
                    canProject: project,
                  ),
                ),
              );
              await tester.pumpAndSettle();
              // After the pump: `tr` answers in the locale just loaded.
              final now = tr('dashboard.now');

              final boxes = <(String, Rect)>[
                for (final element in find.byType(Text).evaluate())
                  if (_dateRowLabel.hasMatch(
                    (element.widget as Text).data ?? '',
                  ))
                    (
                      (element.widget as Text).data!,
                      tester.getRect(find.byWidget(element.widget)),
                    ),
              ]..sort((a, b) => a.$2.left.compareTo(b.$2.left));

              final where = 'w$width forecast=$project span=$span';
              expect(
                boxes.map((b) => b.$1),
                contains(now),
                reason: '"$now" is never the tick that gives way ($where)',
              );
              for (var i = 1; i < boxes.length; i++) {
                final gap = boxes[i].$2.left - boxes[i - 1].$2.right;
                if (gap < kWeightAxisGap - 0.5) {
                  collisions.add(
                    '$where: "${boxes[i - 1].$1}" | "${boxes[i].$1}" '
                    'gap ${gap.toStringAsFixed(1)}',
                  );
                }
              }
            }
          }
        }

        expect(collisions, isEmpty, reason: collisions.join('\n'));
      });
    }
  }
}
