import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/sheets/manual/manual_log_sheet.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import '../../../l10n_test_loader.dart';

/// Search rows shaped like the enriched endpoint's: real Vietnamese names,
/// card English names, a state only where the card claims one, and the
/// vessel hint the ruler is built from.
const chickenRaw = {
  'id': 'fct-chicken-raw',
  'namePrimary': 'Ức gà',
  'nameEn': 'Chicken, broilers or fryers, breast, meat only, raw',
  'state': 'raw',
  'displayNameEn': 'Skinless chicken breast',
  'stateLabel': 'raw',
  'vessel': {'family': 'piece', 'kind': 'poultry'},
  'per100g': {
    'caloriesKcal': 120,
    'proteinG': 22.5,
    'carbohydrateG': 0,
    'fatG': 2.6,
  },
};

const chickenStewed = {
  'id': 'fct-chicken-stewed',
  'namePrimary': 'Ức gà hầm, bỏ da',
  'nameEn': 'Chicken, broilers or fryers, breast, meat only, cooked, stewed',
  'state': 'cooked',
  'displayNameEn': 'Skinless chicken breast, stewed',
  'stateLabel': 'cooked',
  'vessel': {'family': 'piece', 'kind': 'poultry'},
  'per100g': {'caloriesKcal': 151, 'proteinG': 29, 'fatG': 3},
};

const rice = {
  'id': 'fct-rice',
  'namePrimary': 'Cơm trắng',
  'nameEn': 'Rice, white, long-grain, regular, cooked',
  'state': 'cooked',
  'displayNameEn': 'Long-grain white rice, unsalted',
  'stateLabel': 'cooked',
  'vessel': {'family': 'bowl', 'dishClass': 'solid'},
  'per100g': {
    'caloriesKcal': 130,
    'proteinG': 2.7,
    'carbohydrateG': 28,
    'fatG': 0.3,
  },
};

const yogurt = {
  'id': 'fct-yogurt',
  'namePrimary': 'Sữa chua (từ sữa bò)',
  'nameEn': 'Yogurt, plain, whole milk',
  'state': 'raw',
  'displayNameEn': 'Plain whole-milk yogurt',
  'stateLabel': null,
  'vessel': null,
  'per100g': {
    'caloriesKcal': 61,
    'proteinG': 3.5,
    'carbohydrateG': 4.7,
    'fatG': 3.3,
  },
};

/// A packaged drink: its brand stands where a state would, and it pours.
const milk = {
  'id': 'fct-milk',
  'namePrimary': 'Sữa tươi tiệt trùng có đường',
  'nameEn': 'Milk, sweetened',
  'state': 'raw',
  'displayNameEn': 'Sweetened UHT fresh milk',
  'stateLabel': null,
  'brand': 'Vinamilk',
  'vessel': {'family': 'cup', 'dishClass': 'drink'},
  'per100g': {
    'caloriesKcal': 74,
    'proteinG': 3,
    'carbohydrateG': 9.6,
    'fatG': 3,
  },
};

/// Answers the search like the server: recents for an empty query, chicken
/// for "ức gà". Records every POST; answers the cache cascade a save
/// invalidates with empty payloads.
class FakeManualApi extends ApiClient {
  final List<(String, Object?)> posts = [];

  @override
  Future<T> get<T>(String path) async {
    if (path.startsWith('/api/v1/ingredients/search')) {
      final q = Uri.parse(path).queryParameters['q'] ?? '';
      final results =
          q.isEmpty
              ? [chickenRaw, rice, yogurt, milk]
              : q.contains('gà')
              ? [chickenRaw, chickenStewed]
              : <Map<String, Object?>>[];
      return {'results': results} as T;
    }
    if (path.startsWith('/api/v1/meals/dates')) return <dynamic>[] as T;
    return <String, dynamic>{} as T;
  }

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    posts.add((path, body));
    return <String, dynamic>{'mealId': 'meal-1', 'meal': <String, dynamic>{}}
        as T;
  }
}

Widget wrapManual(Widget child, ApiClient api) => ProviderScope(
  overrides: [apiClientProvider.overrideWithValue(api)],
  child: EasyLocalization(
    supportedLocales: const [Locale('en'), Locale('vi')],
    path: 'assets/l10n',
    fallbackLocale: const Locale('en'),
    startLocale: const Locale('en'),
    assetLoader: const FsL10nLoader(),
    child: Builder(
      builder:
          (context) => MaterialApp(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            home: Scaffold(body: child),
          ),
    ),
  ),
);

/// A host with one button that opens the meal sheet, pumped and opened.
Future<void> openManualSheet(WidgetTester tester, ApiClient api) async {
  await tester.pumpWidget(
    wrapManual(
      Builder(
        builder:
            (c) => Center(
              child: TextButton(
                onPressed:
                    () =>
                        showManualLogSheet(c, userId: 'u1', date: '2026-06-12'),
                child: const Text('open'),
              ),
            ),
      ),
      api,
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

/// Type into the add sheet's search and wait out its 300 ms debounce.
Future<void> search(WidgetTester tester, String query) async {
  await tester.enterText(find.byType(TextField).last, query);
  await tester.pump(const Duration(milliseconds: 350));
  await tester.pumpAndSettle();
}

void sizeTo(WidgetTester tester, Size size, [double scale = 1]) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  tester.platformDispatcher.textScaleFactorTestValue = scale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
}
