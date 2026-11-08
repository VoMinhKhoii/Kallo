import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/circle/data/local_blocks.dart';
import 'package:kallo_mobile/features/circle/widgets/share/add_friend_row.dart';
import 'package:kallo_mobile/features/circle/widgets/share/share_meal_sheet.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/models/social/circle.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';

const _longMeal =
    '1 bánh mì xíu mại, chả lụa, nem nướng (pate, hành phi, không bơ, rau dưa '
    'đầy đủ)';

CircleProfile _profile(int i) =>
    CircleProfile(userId: 'u$i', handle: 'ban$i', displayName: 'Bạn số $i');

List<CircleMember> _friends(int n) => [
  for (var i = 1; i <= n; i++)
    CircleMember(friendshipId: 'f$i', status: 'accepted', profile: _profile(i)),
];

Future<void> _pumpSheet(WidgetTester tester, {int friends = 8}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        visibleCircleFriendsProvider.overrideWith(
          (ref) => AsyncValue.data(_friends(friends)),
        ),
        myCircleProfileProvider.overrideWith((ref) async => _profile(0)),
      ],
      child: EasyLocalization(
        supportedLocales: const [Locale('en'), Locale('vi')],
        path: 'assets/l10n',
        startLocale: const Locale('vi'),
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder:
              (context) => MaterialApp(
                localizationsDelegates: context.localizationDelegates,
                supportedLocales: context.supportedLocales,
                locale: context.locale,
                home: Scaffold(
                  body: Align(
                    alignment: Alignment.bottomCenter,
                    child: ShareMealSheet(
                      meal: const PersistedMeal(
                        id: 'm1',
                        rawInput: _longMeal,
                        loggedAt: '2026-11-08T11:23:00Z',
                        nutrition: MealNutrition(caloriesKcal: 424),
                        mealItemGroups: [],
                      ),
                      onAddFriends: () {},
                    ),
                  ),
                ),
              ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _seatFirst(WidgetTester tester) async {
  await tester.tap(find.byType(AddFriendRow).first);
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await loadIconFonts();
  });

  testWidgets('the split tab comes before the whole tab', (tester) async {
    await _pumpSheet(tester);
    expect(
      tester.getCenter(find.text('Chia phần')).dx,
      lessThan(tester.getCenter(find.text('Nguyên phần')).dx),
    );
  });

  testWidgets('one prompt line until a friend is added, then the list title', (
    tester,
  ) async {
    const prompt = 'Thêm một người bạn để chia sẻ bữa ăn này';
    await _pumpSheet(tester);
    expect(find.text(prompt), findsOneWidget);
    expect(find.text('Thêm bạn'), findsNothing);

    await _seatFirst(tester);
    expect(find.text(prompt), findsNothing);
    expect(find.text('Thêm bạn'), findsOneWidget);

    await tester.tap(find.byIcon(LucideIcons.x300).last);
    await tester.pumpAndSettle();
    expect(find.text(prompt), findsOneWidget);
  });

  for (final tab in ['Chia phần', 'Nguyên phần']) {
    testWidgets('six friends are all on screen on the $tab tab', (
      tester,
    ) async {
      await _pumpSheet(tester, friends: 7);
      await _seatFirst(tester);
      await tester.tap(find.text(tab));
      await tester.pumpAndSettle();

      final screen = tester.getRect(find.byType(Scaffold));
      final footerTop = tester.getTopLeft(find.text('Huỷ')).dy;
      final rows = find.byType(AddFriendRow);
      expect(rows, findsNWidgets(6));
      for (final row in rows.evaluate()) {
        final rect = tester.getRect(find.byWidget(row.widget));
        expect(rect.top, greaterThanOrEqualTo(screen.top));
        expect(rect.bottom, lessThanOrEqualTo(footerTop));
      }
      // Nothing left for the sheet's own body to scroll.
      final body = tester.state<ScrollableState>(find.byType(Scrollable).first);
      expect(body.position.maxScrollExtent, 0);
    });
  }
}
