import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart' show CupertinoPage;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:kallo_mobile/features/logging/data/logging_providers.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/meal_input.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/quick_log_sheet.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet.dart';

import '../../l10n_test_loader.dart';

/// The dashboard's quick-log sheet: how it survives the keyboard coming up,
/// where it leaves the user after Send, and what it offers besides typing.
const _screen = Size(390, 844);
const _dpr = 2.0;

/// The home indicator, in physical px — 34 logical, an iPhone's bottom inset.
const _homeIndicator = 34.0 * _dpr;

/// The keyboard checkpoints the ramp passes through, in PHYSICAL px.
const _keyboardCheckpoints = [0.0, 60.0, 150.0, 300.0];

final _session = Session(
  accessToken: 'token',
  tokenType: 'bearer',
  user: const User(
    id: '11111111-1111-1111-1111-111111111111',
    appMetadata: {},
    userMetadata: {},
    aud: 'authenticated',
    createdAt: '2026-07-28T00:00:00.000Z',
  ),
);

void _sizeTo(WidgetTester tester, {double keyboard = 0}) {
  tester.view.devicePixelRatio = _dpr;
  tester.view.physicalSize = _screen * _dpr;
  tester.view.viewPadding = const FakeViewPadding(bottom: _homeIndicator);
  tester.view.viewInsets = FakeViewPadding(bottom: keyboard);
  addTearDown(tester.view.reset);
}

Widget _wrap(ProviderContainer container, Widget child) =>
    UncontrolledProviderScope(
      container: container,
      child: EasyLocalization(
        supportedLocales: const [Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder: (context) => MaterialApp(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            // NO Scaffold: `resizeToAvoidBottomInset` shrinks the body AND
            // strips the bottom view insets from the MediaQuery it hands down,
            // so the sheet inside one never sees the keyboard at all and this
            // test would measure `viewPadding` decaying instead of the ramp.
            // The real sheet is a route on the root navigator, not a body.
            home: Material(
              color: Colors.white,
              child: Align(alignment: Alignment.bottomCenter, child: child),
            ),
          ),
        ),
      ),
    );

ProviderContainer _container() {
  final container = ProviderContainer(
    overrides: [currentSessionProvider.overrideWithValue(_session)],
  );
  addTearDown(container.dispose);
  return container;
}

/// The gap the sheet holds under the composer: from the bottom of the
/// [MealInput] to the bottom edge of the painted sheet surface.
double _gap(WidgetTester tester) {
  final surface = tester.getRect(
    find
        .descendant(
          of: find.byType(KalloSheetSurface),
          matching: find.byType(Container),
        )
        .first,
  );
  return surface.bottom - tester.getRect(find.byType(MealInput)).bottom;
}

/// The checkpoints above, walked in steps of at most 8 LOGICAL pt — a keyboard
/// inset arrives as an animation, not as one value, so the frames in between
/// are exactly where a discontinuity shows up. The 1pt first step is the
/// discriminating one: it is frame 1 of the iOS ramp.
List<double> _rampLogical() {
  final out = <double>[0, 1];
  for (final checkpoint in _keyboardCheckpoints.skip(1)) {
    final target = checkpoint / _dpr;
    while (target - out.last > 8) {
      out.add(out.last + 8);
    }
    out.add(target);
  }
  return out;
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
  });

  testWidgets('the composer gap decays with the keyboard, never steps', (
    tester,
  ) async {
    _sizeTo(tester);
    await tester.pumpWidget(_wrap(_container(), const QuickLogSheet()));
    await tester.pumpAndSettle();

    // At rest the sheet owes the home indicator plus the 4pt gap: 38.
    expect(_gap(tester), closeTo(38, 0.01));

    var previousGap = _gap(tester);
    var previousInset = 0.0;
    for (final inset in _rampLogical().skip(1)) {
      tester.view.viewInsets = FakeViewPadding(bottom: inset * _dpr);
      await tester.pump();
      final gap = _gap(tester);
      expect(
        gap,
        lessThanOrEqualTo(previousGap + 0.01),
        reason: 'the gap must only ever shrink as the keyboard rises',
      );
      expect(
        previousGap - gap,
        lessThanOrEqualTo(8.01),
        reason:
            'a ${(inset - previousInset).toStringAsFixed(1)}pt keyboard step '
            'moved the gap ${(previousGap - gap).toStringAsFixed(1)}pt — that '
            'is the branch on `viewInsets > 0` back again',
      );
      previousGap = gap;
      previousInset = inset;
    }

    // …and it floors rather than collapsing: the composer keeps 8pt of air
    // over a fully raised keyboard.
    expect(previousGap, closeTo(8, 0.01));
  });

  testWidgets('Send parks the meal and lands on /logging', (tester) async {
    _sizeTo(tester);
    final container = _container();
    var sheetClosed = false;

    final router = GoRouter(
      initialLocation: '/dashboard',
      routes: [
        GoRoute(
          path: '/dashboard',
          builder: (_, _) => Scaffold(
            body: Consumer(
              builder: (context, ref, _) => TextButton(
                onPressed: () async {
                  await showQuickLogSheet(context, ref);
                  sheetClosed = true;
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
        GoRoute(
          path: '/logging',
          pageBuilder: (_, _) => const CupertinoPage<void>(
            child: Scaffold(body: Text('logging-page')),
          ),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: EasyLocalization(
          supportedLocales: const [Locale('en')],
          path: 'assets/l10n',
          fallbackLocale: const Locale('en'),
          assetLoader: const FsL10nLoader(),
          child: Builder(
            builder: (context) => MaterialApp.router(
              localizationsDelegates: context.localizationDelegates,
              supportedLocales: context.supportedLocales,
              locale: context.locale,
              routerConfig: router,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.byType(QuickLogSheet), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'phở bò');
    await tester.pump();
    await tester.tap(find.bySemanticsLabel('logging.submit'.tr()));
    await tester.pumpAndSettle();

    expect(
      container.read(pendingMealProvider),
      'phở bò',
      reason: 'the feed claims the meal from here',
    );
    expect(
      find.text('logging-page'),
      findsOneWidget,
      reason: '/logging must be the route the user is left on',
    );
    expect(
      find.byType(QuickLogSheet),
      findsNothing,
      reason: 'the sheet is removed silently underneath the pushed feed',
    );
    expect(
      sheetClosed,
      isTrue,
      reason: "showQuickLogSheet's future must complete (with a null result)",
    );
  });

  testWidgets('the scan glyph is offered where barcode logging is', (
    tester,
  ) async {
    // Barcode logging is iOS-only, and the row hides the glyph wherever it is
    // not offered. Reset before the test body ends — the binding asserts on a
    // foundation debug variable left set.
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    _sizeTo(tester);
    await tester.pumpWidget(_wrap(_container(), const QuickLogSheet()));
    await tester.pumpAndSettle();

    final scan = find.bySemanticsLabel('logging.barcode.title'.tr());
    final found = scan.evaluate().length;
    debugDefaultTargetPlatformOverride = null;
    expect(
      found,
      1,
      reason: 'the sheet must pass onBarcodePressed, or the row hides the glyph',
    );
  });
}
