import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/sheets/manual/manual_log_sheet.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';

/// The manual-log sheet is the native pass's biggest relayout: the added card
/// stacks from the top, Save sits under it, and the search pill is pinned to
/// the very bottom with the results growing up toward it. Nothing in that
/// arrangement is bounded by a scroll view the way the old ListView body was,
/// so this asserts what would break silently — the search field and the Save
/// button both staying ON SCREEN, on the viewports that actually break sheets
/// and at the app's 1.3x Dynamic Type ceiling.
class _FakeApiClient extends ApiClient {
  @override
  Future<T> get<T>(String path) async => const {
    'results': [
      {
        'id': 'fct-rice',
        'namePrimary': 'Cơm trắng',
        'nameEn': 'White rice',
        'state': 'cooked',
        'per100g': {'caloriesKcal': 130.0, 'proteinG': 2.7},
      },
      {
        'id': 'fct-pork',
        'namePrimary': 'Thịt heo nạc luộc',
        'nameEn': 'Lean pork, boiled',
        'state': 'cooked',
        'per100g': {'caloriesKcal': 165.0, 'proteinG': 27.0},
      },
    ],
  } as T;
}

/// A results list long enough to fill the sheet — the state in which the added
/// summary lands off-screen.
class _LongResultsApiClient extends ApiClient {
  @override
  Future<T> get<T>(String path) async => {
    'results': [
      for (var i = 0; i < 12; i++)
        {
          'id': 'fct-$i',
          'namePrimary': 'Món số $i',
          'nameEn': 'Dish number $i',
          'state': 'cooked',
          'per100g': {'caloriesKcal': 100.0 + i, 'proteinG': 5.0},
        },
    ],
  } as T;
}

const _viewports = <String, Size>{
  'short phone': Size(320, 568),
  'android': Size(360, 640),
  'landscape': Size(667, 375),
};

Widget _wrap(Widget child, {ApiClient? api}) => ProviderScope(
  overrides: [apiClientProvider.overrideWithValue(api ?? _FakeApiClient())],
  child: EasyLocalization(
    supportedLocales: const [Locale('en'), Locale('vi')],
    path: 'assets/l10n',
    fallbackLocale: const Locale('en'),
    assetLoader: const FsL10nLoader(),
    child: Builder(
      builder: (context) => MaterialApp(
        localizationsDelegates: context.localizationDelegates,
        supportedLocales: context.supportedLocales,
        locale: context.locale,
        home: Scaffold(body: child),
      ),
    ),
  ),
);

void _sizeTo(WidgetTester tester, Size size, double scale) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  tester.platformDispatcher.textScaleFactorTestValue = scale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
}

Future<void> _expectOnScreen(
  WidgetTester tester,
  Finder finder,
  Size size,
  String what,
) async {
  expect(finder, findsOneWidget, reason: '$what is missing');
  final rect = tester.getRect(finder);
  expect(
    rect.bottom,
    lessThanOrEqualTo(size.height + 0.5),
    reason: '$what clipped below the ${size.width}x${size.height} viewport',
  );
  expect(rect.top, greaterThanOrEqualTo(-0.5), reason: '$what clipped above');
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

  for (final entry in _viewports.entries) {
    for (final scale in [1.0, 1.3]) {
      final where = '${entry.key} @${scale}x';

      testWidgets('manual log sheet — search pinned to bottom, $where', (
        tester,
      ) async {
        _sizeTo(tester, entry.value, scale);
        await tester.pumpWidget(
          _wrap(
            Builder(
              builder: (c) => TextButton(
                onPressed: () =>
                    showManualLogSheet(c, userId: 'u1', date: '2026-01-01'),
                child: const Text('open'),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();

        await _expectOnScreen(
          tester,
          find.byType(TextField).last,
          entry.value,
          'the search field',
        );

        // Adding an ingredient grows the sheet from the top; Save must not be
        // the thing that leaves the screen for it.
        await tester.tap(find.text('Cơm trắng'));
        await tester.pumpAndSettle();
        await _expectOnScreen(
          tester,
          find.textContaining('Save ·'),
          entry.value,
          'the Save button',
        );
      });
    }
  }

  testWidgets('adding an item scrolls its confirmation into view',
      (tester) async {
    // The body opens scrolled to the BOTTOM (`reverse: true`), so the "Added"
    // summary and "Save · N kcal" insert ABOVE the current scroll position.
    // With a full results list that put the only confirmation a tap had landed
    // off-screen: the row seemed to do nothing. The add must reveal it.
    _sizeTo(tester, const Size(320, 568), 1.0);
    await tester.pumpWidget(
      _wrap(
        Builder(
          builder: (c) => TextButton(
            onPressed: () =>
                showManualLogSheet(c, userId: 'u1', date: '2026-01-01'),
            child: const Text('open'),
          ),
        ),
        api: _LongResultsApiClient(),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Món số 0'));
    await tester.pumpAndSettle();

    await _expectOnScreen(
      tester,
      find.text('Added'),
      const Size(320, 568),
      'the Added summary',
    );
    // Visible AND reachable — not merely inside the viewport rect.
    expect(tester.any(find.text('Added').hitTestable()), isTrue,
        reason: 'the Added summary is not hit-testable');
  });
}
