import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/data/logging_day.dart';
import 'package:kallo_mobile/features/dashboard/widgets/today/today_meal_list.dart';
import 'package:kallo_mobile/shared/widgets/nutrition/meal_block.dart';

import '../../l10n_test_loader.dart';

/// Recent meals draws the SHARED meal block (native pass, 2026-08-31), with
/// kcal on the title line and no timestamp — the time belongs to Circle posts,
/// where a meal has an author and a moment; your own dock only has the day.
Widget _wrap(Widget child) => EasyLocalization(
      supportedLocales: const [Locale('en')],
      path: 'assets/l10n',
      fallbackLocale: const Locale('en'),
      assetLoader: const FsL10nLoader(),
      child: Builder(
        builder: (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          home: Scaffold(
            body: Center(child: SizedBox(width: 358, child: child)),
          ),
        ),
      ),
    );

PersistedMeal _meal({
  required String id,
  required String name,
  double? protein = 28,
}) =>
    PersistedMeal(
      id: id,
      rawInput: name,
      loggedAt: '2026-08-31T13:04:00Z',
      nutrition: MealNutrition(
        caloriesKcal: 420,
        proteinG: protein,
        carbohydrateG: 52,
        fatG: 9,
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
  });

  testWidgets('a meal row is a MealBlock with kcal on the title line',
      (tester) async {
    await tester.pumpWidget(
      _wrap(MealList(meals: [_meal(id: '1', name: 'Phở bò tái')])),
    );
    await tester.pumpAndSettle();

    final block = tester.widget<MealBlock>(find.byType(MealBlock));
    expect(block.kcalPlacement, MealBlockKcal.titleRight);
    expect(block.kcalLabel, '420 kcal');
    expect(block.gramLabels['protein'], 'P 28g');
    expect(find.text('Phở bò tái'), findsOneWidget);
    // No timestamp on your own meals.
    expect(find.textContaining(':'), findsNothing);
  });

  testWidgets('an unmeasured macro reads as a dash, not a confident zero',
      (tester) async {
    await tester.pumpWidget(
      _wrap(MealList(meals: [_meal(id: '1', name: 'Cơm tấm', protein: null)])),
    );
    await tester.pumpAndSettle();

    final block = tester.widget<MealBlock>(find.byType(MealBlock));
    expect(block.gramLabels['protein'], 'P —');
  });

  testWidgets('rows are separated by one inset hairline each', (tester) async {
    await tester.pumpWidget(
      _wrap(
        MealList(
          meals: [
            _meal(id: '1', name: 'Phở bò tái'),
            _meal(id: '2', name: 'Cơm tấm sườn bì'),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(MealBlock), findsNWidgets(2));
    expect(find.byType(Divider), findsOneWidget);
  });
}
