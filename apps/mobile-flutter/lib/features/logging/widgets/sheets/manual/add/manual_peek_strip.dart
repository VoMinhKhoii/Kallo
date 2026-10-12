import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../../models/nutrition/ingredient.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../logic/manual/manual_display.dart';

/// The meal sheet's edge, peeking above the add sheet stacked on it, with the
/// one thing worth knowing while you search: what is already on the plate,
/// and on a food's page what the plate becomes with it.
///
/// Drawn by the add sheet itself rather than by scaling the meal sheet back the
/// way UIKit does: Flutter's modal route has no presenting-sheet transform, and
/// the strip is the part of that look that carries information.
class ManualPeekStrip extends StatelessWidget {
  const ManualPeekStrip({super.key, required this.text, this.after});

  /// What is on the plate now: "3 ingredients · 295 kcal".
  final String text;

  /// What it becomes, after an arrow: "475 kcal with this". The arrow is an
  /// icon because Be Vietnam Pro has no "→" glyph — iOS would set that one
  /// character in a fallback face.
  final String? after;

  /// How much of the strip shows above the add sheet: its 7pt inset, one
  /// caption line at the reader's text size, and 4pt of air — 26 at 1x.
  static double visibleHeight(BuildContext context) =>
      7 + MediaQuery.textScalerOf(context).scale(12) * 1.25 + 4;

  /// The strip's two halves for the meal [items]: what is on the plate, and —
  /// with a [food] page open — what the plate becomes with it at [grams]
  /// (replacing [itemId]'s amount when that food is already in the meal).
  static (String, String?) texts(
    List<ManualLogItem> items, {
    IngredientSearchResult? food,
    double grams = 0,
    String? itemId,
  }) {
    final total = totalsForManualItems(items).caloriesKcal ?? 0;
    final summary = 'logging.manualLogging.peek'.tr(
      namedArgs: {
        'count': 'logging.manualLogging.ingredientCount'.plural(items.length),
        'kcal': formatKcal(total),
      },
    );
    if (food == null) {
      return (
        items.isEmpty ? 'logging.manualLogging.peekEmpty'.tr() : summary,
        null,
      );
    }
    final after = formatKcal(
      mealKcalWith(items, food, grams, replacing: itemId),
    );
    // An edit that hasn't moved the total yet has nothing to point at.
    if (itemId != null && after == formatKcal(total)) return (summary, null);
    return (
      summary,
      (itemId == null
              ? 'logging.manualLogging.peekWith'
              : 'logging.manualLogging.peekAfter')
          .tr(namedArgs: {'kcal': after}),
    );
  }

  /// The strip's tint: the meal sheet's canvas under the route's dimming.
  static const Color _fill = Color(0xFFD9D6CE);
  static const Color _ink = Color(0xFF55534D);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(top: 7, left: 24, right: 24),
      decoration: const BoxDecoration(
        color: _fill,
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      alignment: Alignment.topCenter,
      child: Text.rich(
        TextSpan(
          text: text,
          children: [
            if (after != null) ...[
              const TextSpan(text: ' '),
              const WidgetSpan(
                alignment: PlaceholderAlignment.middle,
                child: Icon(LucideIcons.arrowRight300, size: 12, color: _ink),
              ),
              TextSpan(text: ' $after'),
            ],
          ],
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        textAlign: TextAlign.center,
        // Caption tier: a sliver of the sheet behind, not a row of this one.
        style: dashCaption(color: _ink, tabular: true),
      ),
    );
  }
}
