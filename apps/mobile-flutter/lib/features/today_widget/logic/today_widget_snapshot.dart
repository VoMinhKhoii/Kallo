/// The day the home-screen widget draws, as the JSON it reads.
///
/// Pure: no ref, no context, no plugin. The widget extension
/// (`ios/TodayWidget/TodaySnapshot.swift`) decodes exactly this shape; change
/// a key here and change it there, and bump [kTodayWidgetSnapshotVersion]
/// so an old extension shows its signed-out card rather than misreading.
///
/// Every word the widget shows is resolved HERE, in the language the user
/// picked in Kallo — the extension has no l10n of its own and never falls
/// back to the phone's language for a figure or a sentence.
library;

import 'package:intl/intl.dart';

import '../../../shared/logic/display_format.dart';
import '../../logging/data/logging_models.dart';
import '../../logging/logic/format.dart' show fmtKcal;

const int kTodayWidgetSnapshotVersion = 1;

/// The l10n keys the widget's copy is read from — the dials' own wording.
const Map<String, String> kTodayWidgetCopyKeys = {
  'kcalEaten': 'dashboard.caloriesLogged',
  'eatenShort': 'dashboard.loggedShort',
  'leftOfTarget': 'dashboard.leftOfTarget',
  'overTargetBy': 'dashboard.overTargetBy',
  'fraction': 'dashboard.loggedOverTarget',
  'protein': 'dashboard.protein',
  'carbs': 'dashboard.carbs',
  'fat': 'dashboard.fat',
  'signedOut': 'common.notSignedIn',
};

/// Resolves an l10n key with its `{placeholders}` left in place — the widget
/// fills them itself, because at midnight it must say "0" with the app closed.
typedef CopyLookup = String Function(String key);

/// One saved meal, as the widget needs it. The Log screen and Today each keep
/// their own meal model; both map onto this.
typedef TodayWidgetMeal =
    ({
      String loggedAt,
      String rawInput,
      double? kcal,
      double? protein,
      double? carbs,
      double? fat,
    });

/// The snapshot's macro keys and where each meal keeps its value.
final Map<String, double? Function(TodayWidgetMeal m)> _macros = {
  'kcal': (m) => m.kcal,
  'protein': (m) => m.protein,
  'carbs': (m) => m.carbs,
  'fat': (m) => m.fat,
};

/// The day for a signed-in user: [date]'s saved meals against [profile].
///
/// Staged (unconfirmed) analyses are left out, exactly as the dials leave them
/// out: a meal counts once it is saved. A meal with an unknown value still
/// counts what it knows, and that total is marked a floor (`≥`).
Map<String, Object?> todayWidgetSnapshot({
  required String date,
  required String locale,
  required LoggingProfile profile,
  required List<TodayWidgetMeal> meals,
  required CopyLookup tr,
}) {
  final saved = [...meals]..sort((a, b) => a.loggedAt.compareTo(b.loggedAt));
  final time = DateFormat.jm(locale);
  return _envelope(
    date: date,
    locale: locale,
    signedIn: true,
    target: {
      'kcal': profile.calorieTarget,
      'protein': profile.proteinTargetG,
      'carbs': profile.carbsTargetG,
      'fat': profile.fatTargetG,
    },
    eaten: {
      for (final MapEntry(key: key, value: pick) in _macros.entries)
        key: round0(saved.fold<double>(0, (sum, m) => sum + (pick(m) ?? 0))),
    },
    floors: [
      for (final MapEntry(key: key, value: pick) in _macros.entries)
        if (saved.any((m) => pick(m) == null)) key,
    ],
    meals: [
      for (final m in saved)
        {
          'time': time.format(DateTime.parse(m.loggedAt).toLocal()),
          'text': capitalizeFirst(m.rawInput),
          'kcal': fmtKcal(m.kcal, locale: locale),
        },
    ],
    tr: tr,
  );
}

/// What a signed-out phone shows: no day at all, only the app's own words.
Map<String, Object?> todayWidgetSignedOut({
  required String date,
  required String locale,
  required CopyLookup tr,
}) => _envelope(
  date: date,
  locale: locale,
  signedIn: false,
  target: _zero,
  eaten: _zero,
  floors: const [],
  meals: const [],
  tr: tr,
);

/// The one shape both cards share, so neither can drift from the Swift.
Map<String, Object?> _envelope({
  required String date,
  required String locale,
  required bool signedIn,
  required Map<String, int> target,
  required Map<String, int> eaten,
  required List<String> floors,
  required List<Map<String, String>> meals,
  required CopyLookup tr,
}) => {
  'v': kTodayWidgetSnapshotVersion,
  'date': date,
  'locale': locale,
  'signedIn': signedIn,
  'target': target,
  'eaten': eaten,
  'floors': floors,
  'meals': meals,
  'copy': {
    for (final MapEntry(key: field, value: key) in kTodayWidgetCopyKeys.entries)
      field: tr(key),
  },
};

const Map<String, int> _zero = {'kcal': 0, 'protein': 0, 'carbs': 0, 'fat': 0};
