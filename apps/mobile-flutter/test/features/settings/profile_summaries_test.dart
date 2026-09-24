import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/settings/logic/profile_summaries.dart';

import '../onboarding/onboarding_test_support.dart';

/// The one-line answers under the Settings root's nutrition-profile rows. They
/// are the reason a field can be found from the root at all, so they must say
/// what the page holds in the user's language — and must say what is MISSING
/// rather than echo the neutral defaults the pages open on.

const _full = <String, dynamic>{
  'biologicalSex': 'male',
  'weightKg': '68.5',
  'heightCm': 172,
  'age': 29,
  'goal': 'cutting',
  'aggression': '0.5',
  'calorieTarget': 1800,
  'oilUsage': 'normal',
  'defaultRicePortion': 'medium',
  'defaultProteinPortion': 'medium',
  'brothConsumption': 'some',
  'countryOfResidence': 'Vietnam',
};

Future<void> _in(WidgetTester tester, String lang) async {
  late BuildContext ctx;
  await tester.pumpWidget(
    localizedHome(
      Builder(
        builder: (context) {
          ctx = context;
          return const SizedBox();
        },
      ),
    ),
  );
  await tester.pumpAndSettle();
  await ctx.setLocale(Locale(lang));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() => initOnboardingTest(fonts: false));

  testWidgets('a complete profile reads back in Vietnamese', (tester) async {
    await _in(tester, 'vi');
    const p = ProfileRow(_full);
    expect(
      ProfileSummaries.aboutYou(p, 'vi'),
      'Nam · 29 tuổi · 172 cm · 68,5 kg',
    );
    expect(
      ProfileSummaries.goal(p, 'vi'),
      'Giảm cân · 0,5 kg/tuần · 1.800 kcal',
    );
    expect(
      ProfileSummaries.cooking(p),
      'Dầu vừa · Cơm vừa · Đạm vừa · Uống một ít',
    );
    expect(ProfileSummaries.region(p, 'vi'), 'Việt Nam · Tiếng Việt');
  });

  testWidgets('English capitalises each segment', (tester) async {
    await _in(tester, 'en');
    expect(
      ProfileSummaries.cooking(const ProfileRow(_full)),
      'Normal oil · Medium rice · Medium protein · Drink some',
    );
  });

  testWidgets('says what is missing instead of echoing defaults', (
    tester,
  ) async {
    await _in(tester, 'vi');
    const blank = ProfileRow({});
    expect(ProfileSummaries.aboutYou(blank, 'vi'), tr('settings.rows.notSet'));
    expect(
      ProfileSummaries.goal(blank, 'vi'),
      tr('settings.rows.needsBodyFirst'),
    );
    expect(ProfileSummaries.cooking(blank), tr('settings.rows.cookingDefault'));
    expect(ProfileSummaries.region(blank, 'vi'), 'Tiếng Việt');

    // A body with no goal yet is "not set", not "add your body first".
    final noGoal = ProfileRow({..._full}..remove('goal'));
    expect(ProfileSummaries.goal(noGoal, 'vi'), tr('settings.rows.notSet'));
  });

  testWidgets('maintaining carries no pace', (tester) async {
    await _in(tester, 'vi');
    final p = ProfileRow(Map.of(_full)..['goal'] = 'maintaining');
    expect(ProfileSummaries.goal(p, 'vi'), 'Duy trì · 1.800 kcal');
  });
}
