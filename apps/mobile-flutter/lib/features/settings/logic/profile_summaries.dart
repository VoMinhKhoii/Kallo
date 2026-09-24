import 'package:easy_localization/easy_localization.dart';

import '../../../models/profile/onboarding.dart';
import '../../../shared/data/countries.dart';
import '../../onboarding/data/profile_row.dart';
import '../../onboarding/logic/onboarding_seed.dart';
import '../../onboarding/screens/step_cooking.dart';

/// The one-line answers under each "Hồ sơ dinh dưỡng" row on the Settings
/// root — what the row's page holds, so a row can be found by what it says
/// ("Nam · 29 tuổi · 172 cm · 68,5 kg") and not only by its name.
///
/// Each line says what is MISSING when the page is incomplete, instead of
/// inventing a value: the seed fills blanks with neutral defaults so the
/// onboarding controls open pre-answered, and a summary built from those
/// would claim the user had said things they never said.
abstract final class ProfileSummaries {
  static const String _sep = ' · ';

  /// Joins segments so a wrapped line breaks BETWEEN them, never inside one:
  /// each segment's own spaces become no-break spaces. A two-line subline
  /// that ended on "Uống một / ít" split the one answer that mattered.
  static String _join(Iterable<String> segments) =>
      segments.map((s) => s.replaceAll(' ', '\u00A0')).join(_sep);

  static bool _hasBody(ProfileRow p) =>
      tryParseBiologicalSex(p.biologicalSex) != null &&
      p.weightKg != null &&
      p.heightCm != null &&
      p.age != null;

  /// "Nam · 29 tuổi · 172 cm · 68,5 kg".
  static String aboutYou(ProfileRow? p, String locale) {
    if (p == null || !_hasBody(p)) return tr('settings.rows.notSet');
    final sex = tryParseBiologicalSex(p.biologicalSex)!;
    final kg = NumberFormat.decimalPattern(locale)..maximumFractionDigits = 1;
    return _join([
      tr('onboarding.bodyMetrics.${sex.name}'),
      '${p.age} ${tr('onboarding.bodyMetrics.ageUnit')}',
      '${p.heightCm} ${tr('onboarding.bodyMetrics.heightUnit')}',
      '${kg.format(p.weightKg)} ${tr('onboarding.bodyMetrics.weightUnit')}',
    ]);
  }

  /// "Giảm cân · 0,5 kg/tuần · 1.800 kcal" — or what has to come first.
  static String goal(ProfileRow? p, String locale) {
    if (p == null || !_hasBody(p)) return tr('settings.rows.needsBodyFirst');
    final goal = tryParseGoal(p.goal);
    if (goal == null) return tr('settings.rows.notSet');
    final parts = [tr('onboarding.bodyMetrics.${goal.name}')];
    final pace = double.tryParse(p.aggression ?? '');
    if (goal != Goal.maintaining && pace != null) {
      final fmt =
          NumberFormat.decimalPattern(locale)
            ..minimumFractionDigits = 1
            ..maximumFractionDigits = 2;
      parts.add(
        tr(
          'settings.rows.pacePerWeek',
          namedArgs: {
            'pace': fmt.format(pace),
            'unit': tr('onboarding.bodyMetrics.weightUnit'),
          },
        ),
      );
    }
    final kcal = num.tryParse('${p.field('calorieTarget') ?? ''}');
    if (kcal != null) {
      parts.add(
        '${NumberFormat.decimalPattern(locale).format(kcal.round())} '
        '${tr('onboarding.bodyMetrics.kcal')}',
      );
    }
    return _join(parts);
  }

  /// "Dầu vừa · Cơm vừa · Đạm vừa · Uống một ít". Read through the cooking
  /// step's own option table, so the words are exactly the ones on its page.
  static String cooking(ProfileRow? p) {
    final saved = [
      p?.oilUsage,
      p?.defaultRicePortion,
      p?.defaultProteinPortion,
      p?.brothConsumption,
    ];
    if (saved.every((v) => v == null)) {
      return tr('settings.rows.cookingDefault');
    }

    final habits = cookingHabitsFrom(p);
    String word(CookingHabit habit) {
      final i = habit.values.indexOf(habit.read(habits));
      return tr(habit.optionLabels[i]).toLowerCase();
    }

    final [oil, rice, protein, broth] = StepCooking.habits;
    final line = tr(
      'settings.rows.cookingSummary',
      namedArgs: {
        'oil': word(oil),
        'rice': word(rice),
        'protein': word(protein),
        'broth': word(broth),
      },
    );
    // Every segment reads as its own item, so each opens with a capital —
    // "Normal oil · Medium rice", "Dầu vừa · … · Uống một ít" — whatever case
    // the template put the answer in.
    return _join(
      line
          .split(_sep)
          .map(
            (seg) =>
                seg.isEmpty ? seg : seg[0].toUpperCase() + seg.substring(1),
          ),
    );
  }

  /// "Việt Nam · Tiếng Việt" — residence, then the app language.
  static String region(ProfileRow? p, String languageCode) {
    final language = tr(
      languageCode == 'vi'
          ? 'onboarding.language.vietnamese'
          : 'onboarding.language.english',
    );
    final residence = p?.countryOfResidence;
    final country = residence == null ? null : countryForValue(residence);
    if (country == null) return language;
    return _join([countryLabel(country, languageCode), language]);
  }
}
