import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/nutrition/nutrition.dart';
import '../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../logic/helpers.dart';
import '../../logic/status.dart';
import 'nutrient_row.dart';

/// A group of nutrients (Vitamins, Minerals) as grouped rows — the anatomy the
/// whole app's grouped cards share, in its display-only form.
///
/// This replaced a 2-column grid of bordered mini-cards (native pass,
/// 2026-08-31). The grid gave every nutrient a card of its own, so a page of
/// twenty read as twenty objects to decide about; as rows they read as one
/// list, which is what they are, and they line up with Settings and the macro
/// card above them.
class NutrientRowsCard extends StatelessWidget {
  const NutrientRowsCard({super.key, required this.cards});

  final List<NutrientCardData> cards;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    return GroupedListCard(
      // No hairlines: every row here ends in a full-width bar whose grey track
      // spans the same text column the separator would, so the line landed
      // directly above a track that was already dividing the rows and read as
      // noise. Safe because this card has no bar-less row — a missing or
      // low-confidence reading still draws its bar, just with an empty fill.
      showSeparators: false,
      children: [
        for (final (index, card) in cards.indexed)
          NutrientRow(
            label: tr(card.labelKey),
            value: nutrientFigure(card, locale),
            percentOfTarget: card.percentOfTarget,
            fillColor: nutrientFillColor(card),
            barDelay: Duration(milliseconds: 60 * index),
          ),
      ],
    );
  }
}

/// The row's figure: the average against its target in the nutrient's own
/// unit. Never a percentage — see [NutrientRow] — and never a zero standing in
/// for a missing reading.
String nutrientFigure(NutrientCardData card, String locale) {
  final avg = card.averagePerDay;
  final target = card.target;
  final avgText = avg != null ? formatLocalizedNumber(avg, locale) : '—';
  if (target != null) {
    return '$avgText / ${formatLocalizedNumber(target, locale)} ${card.unit}';
  }
  if (avg != null) return '$avgText ${card.unit}';
  return '—';
}

/// The bar's fill, and the row's only status signal.
///
/// Three states, not five: met, past a ceiling, and everything in between.
/// `danger`/`offTarget` means "past a limit" in this system — a nutrient merely
/// short of its floor is an ordinary day, and painting it warm turned a page of
/// vitamins into a page of warnings.
Color nutrientFillColor(NutrientCardData card) {
  final pct = card.percentOfTarget;
  if (pct == null || isLowConfidence(card.displayState)) {
    return KalloColors.stone50;
  }
  if (shouldShowExceed(card.nutrientType, pct)) return KalloColors.offTarget;
  if (statusKeyFor(card) == StatusKey.onTarget) {
    return KalloColors.successAccent;
  }
  return kInk;
}
