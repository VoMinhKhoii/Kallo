import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/settings/logic/profile_summaries.dart';

import '../onboarding/onboarding_test_support.dart';
import 'settings_test_support.dart';

/// The one-line answers under the Settings root's nutrition-profile rows. They
/// are the reason a field can be found from the root at all, so they must say
/// what the page holds in the user's language — and must say what is MISSING
/// rather than echo the neutral defaults the pages open on.

/// Summaries keep each segment unbroken with no-break spaces; compare text.
String _plain(String s) => s.replaceAll('\u00A0', ' ');

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
    const p = ProfileRow(kFullProfile);
    expect(
      _plain(ProfileSummaries.aboutYou(p, 'vi')),
      'Nam · 29 tuổi · 172 cm · 68,5 kg',
    );
    expect(
      _plain(ProfileSummaries.goal(p, 'vi')),
      'Giảm cân · 0,5 kg/tuần · 1.800 kcal',
    );
    expect(
      _plain(ProfileSummaries.cooking(p)),
      'Dầu vừa · Cơm vừa · Đạm vừa · Uống một ít',
    );
    expect(_plain(ProfileSummaries.region(p, 'vi')), 'Việt Nam · Tiếng Việt');
  });

  testWidgets('English capitalises each segment', (tester) async {
    await _in(tester, 'en');
    expect(
      _plain(ProfileSummaries.cooking(const ProfileRow(kFullProfile))),
      'Normal oil · Medium rice · Medium protein · Drink some',
    );
  });

  testWidgets('says what is missing instead of echoing defaults', (
    tester,
  ) async {
    await _in(tester, 'vi');
    const blank = ProfileRow({});
    expect(
      _plain(ProfileSummaries.aboutYou(blank, 'vi')),
      tr('settings.rows.notSet'),
    );
    expect(
      _plain(ProfileSummaries.goal(blank, 'vi')),
      tr('settings.rows.needsBodyFirst'),
    );
    expect(
      _plain(ProfileSummaries.cooking(blank)),
      tr('settings.rows.cookingDefault'),
    );
    expect(_plain(ProfileSummaries.region(blank, 'vi')), 'Tiếng Việt');

    // A body with no goal yet is "not set", not "add your body first".
    final noGoal = ProfileRow({...kFullProfile}..remove('goal'));
    expect(
      _plain(ProfileSummaries.goal(noGoal, 'vi')),
      tr('settings.rows.notSet'),
    );
  });

  testWidgets('a legacy profile lists only the habits it stores', (
    tester,
  ) async {
    await _in(tester, 'vi');
    // Protein and broth arrived later: a profile from before them holds oil
    // and rice only, and must not be summarised with the neutral middles.
    final legacy = ProfileRow(
      Map.of(kFullProfile)
        ..remove('defaultProteinPortion')
        ..remove('brothConsumption'),
    );
    expect(_plain(ProfileSummaries.cooking(legacy)), 'Dầu vừa · Cơm vừa');
  });

  testWidgets('maintaining carries no pace', (tester) async {
    await _in(tester, 'vi');
    final p = ProfileRow(Map.of(kFullProfile)..['goal'] = 'maintaining');
    expect(_plain(ProfileSummaries.goal(p, 'vi')), 'Duy trì · 1.800 kcal');
  });

  testWidgets('a wrapped line breaks between answers, never inside one', (
    tester,
  ) async {
    await _in(tester, 'vi');
    final line = ProfileSummaries.cooking(const ProfileRow(kFullProfile));
    // The only breakable spaces are the ones around each separator.
    expect(line.split(' ').length - 1, 2 * ('·'.allMatches(line).length));
    expect(line, contains('Uống\u00A0một\u00A0ít'));
  });
}
