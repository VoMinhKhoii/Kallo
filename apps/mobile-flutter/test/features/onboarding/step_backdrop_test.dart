import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/widgets/backdrop/backdrop_slice.dart';
import 'package:kallo_mobile/features/onboarding/widgets/backdrop/step_backdrop.dart';
import 'package:kallo_mobile/features/onboarding/widgets/onboarding_step_scaffold.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';

/// The four soft blobs the canvas paints behind every wizard step (and behind
/// `/save-plan`, asserted in its own test). Two things matter and neither is a
/// pixel: that FOUR gradients get painted, and that the layer is actually in
/// the step scaffold's tree rather than only in the widget that defines it.
Widget _host(Widget child) => EasyLocalization(
  supportedLocales: const [Locale('en')],
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder: (context) => MaterialApp(
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      home: Builder(
        builder: (inner) => MediaQuery(
          // The bun breathes on an endless Ticker, so `pumpAndSettle` would
          // never return; reduced motion drops the typewriter too.
          data: MediaQuery.of(inner).copyWith(disableAnimations: true),
          child: Scaffold(body: SafeArea(child: child)),
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
    await loadAppFonts();
  });

  testWidgets('paints four radial blobs and nothing else', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: SizedBox(width: 390, height: 844, child: StepBackdrop())),
    );

    // One `drawRect` per blob, each carrying the gradient shader that makes it
    // a blob rather than a rectangle.
    expect(
      find.byType(StepBackdrop),
      paints
        ..rect(hasMaskFilter: false)
        ..rect(hasMaskFilter: false)
        ..rect(hasMaskFilter: false)
        ..rect(hasMaskFilter: false),
    );
    expect(find.byType(StepBackdrop), paintsExactlyCountTimes(#drawRect, 4));
  });

  testWidgets('sits behind the step scaffold, band included', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _host(
        const OnboardingStepScaffold(
          screen: 2,
          title: 'Where are you from?',
          ctaLabel: 'Continue',
          child: SizedBox(height: 2000),
        ),
      ),
    );
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 120));
    }

    // Twice: the page's own layer, and the CTA band's copy of the same field —
    // which is what stops the band cutting a rectangle out of the blobs.
    expect(find.byType(StepBackdrop), findsNWidgets(2));

    final band = tester.widget<BackdropSlice>(find.byType(BackdropSlice));
    final scaffold = tester.getRect(find.byType(OnboardingStepScaffold));
    expect(band.field, scaffold.size, reason: 'the band is off the page field');

    // The band is BOTTOM-anchored on that field, so its own copy lines up.
    final bandRect = tester.getRect(find.byType(BackdropSlice));
    expect(bandRect.bottom, closeTo(scaffold.bottom, 0.5));
  });
}
