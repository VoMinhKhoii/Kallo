import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/widgets/heatmap/heatmap_legend.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';

import '../../../golden_tolerance.dart';
import '../../../l10n_test_loader.dart';

/// Pixel record of the heatmap's key.
///
/// The two defects this file exists for were both invisible to every unit
/// gate: the cheat swatch drew a flat fill inside an accent ring while the
/// cell it explained painted a ringless aurora wash, and the notice carried
/// its weight on the wrong line. Nothing about either was a wrong VALUE — each
/// assertion in the suite still passed. They were wrong PICTURES, and only a
/// picture catches those.
Widget _host(Locale locale) => EasyLocalization(
  supportedLocales: const [Locale('en'), Locale('vi')],
  startLocale: locale,
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder:
        (context) => MaterialApp(
          debugShowCheckedModeBanner: false,
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          // A real Scaffold, not a bare ColoredBox: without a Material
          // ancestor every Text renders with Flutter's amber debug underline,
          // which would be baked into the golden as if it were design.
          home: const Scaffold(
            backgroundColor: kCardSurface,
            body: Padding(
              padding: EdgeInsets.all(12),
              child: Align(
                alignment: Alignment.topLeft,
                child: HeatmapLegend(),
              ),
            ),
          ),
        ),
  ),
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpGoldens();

  // Both locales: Vietnamese is the primary language and its labels are the
  // long ones, so it is the case that actually wraps.
  for (final locale in [const Locale('vi'), const Locale('en')]) {
    testWidgets('legend — ${locale.languageCode}', (tester) async {
      tester.view.physicalSize = const Size(390, 76);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host(locale));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(HeatmapLegend),
        matchesGoldenFile('goldens/heatmap_legend_${locale.languageCode}.png'),
      );
    }, skip: skipOffGoldenPlatform);
  }
}
