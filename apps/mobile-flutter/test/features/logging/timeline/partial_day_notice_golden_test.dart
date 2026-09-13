import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/timeline/partial_day_notice.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';

import '../../../golden_tolerance.dart';
import '../../../l10n_test_loader.dart';

/// Pixel record of the under-logged notice.
///
/// Its two defects were both invisible to the unit gates: the action hugged its
/// label where it should run the band's width, and the emphasis sat on the
/// action instead of the heading. Neither is a wrong value — every assertion
/// passed while the block looked wrong — so only a picture holds them.
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
          home: Scaffold(
            backgroundColor: kCardSurface,
            body: Padding(
              padding: const EdgeInsets.all(12),
              child: Align(
                alignment: Alignment.topCenter,
                child: PartialDayNotice(
                  calories: 1170,
                  target: 1980,
                  onDismiss: () {},
                  onMarkComplete: () {},
                ),
              ),
            ),
          ),
        ),
  ),
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpGoldens();

  for (final locale in [const Locale('vi'), const Locale('en')]) {
    testWidgets('notice — ${locale.languageCode}', (tester) async {
      // iPhone 12 Pro, the width the block was reported wrong at.
      tester.view.physicalSize = const Size(390, 200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host(locale));
      await tester.pumpAndSettle();

      await expectLater(
        find.byType(PartialDayNotice),
        matchesGoldenFile(
          'goldens/partial_day_notice_${locale.languageCode}.png',
        ),
      );
    }, skip: skipOffGoldenPlatform);
  }
}
