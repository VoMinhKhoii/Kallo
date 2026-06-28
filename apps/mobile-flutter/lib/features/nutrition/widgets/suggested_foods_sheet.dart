import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../features/dashboard/widgets/dashboard_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../logic/status.dart';
import '../providers/food_candidates_provider.dart';
import 'food_candidate_row.dart';

/// The under-target, candidate-supported nutrients from an overview, most
/// in-need first — the input to the suggested-foods CTA. Mirrors the web
/// `showChips` gate (supported · confidence ≥ 40 · < 90% of target).
List<NutrientCardData> suggestedFoodNutrients(NutritionOverview overview) {
  final all = [...overview.micronutrients, ...overview.moreNutrients];
  final eligible = all.where(showChips).toList()
    ..sort(
      (a, b) => (a.percentOfTarget ?? 0).compareTo(b.percentOfTarget ?? 0),
    );
  return eligible.take(4).toList();
}

/// Opens the single nutrition CTA: foods that help close the timeline's biggest
/// nutrient gaps, grouped by nutrient. Reuses the per-nutrient candidate catalog
/// (`/api/v1/nutrition/candidates`).
Future<void> showSuggestedFoodsSheet(
  BuildContext context, {
  required List<NutrientCardData> nutrients,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (_) => _SuggestedFoodsSheet(nutrients: nutrients),
  );
}

class _SuggestedFoodsSheet extends StatelessWidget {
  const _SuggestedFoodsSheet({required this.nutrients});

  final List<NutrientCardData> nutrients;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    final maxHeight = MediaQuery.of(context).size.height * 0.85;

    return Container(
      constraints: BoxConstraints(maxHeight: maxHeight),
      decoration: const BoxDecoration(
        color: NhamColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(NhamRadii.xxl)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header — X (close) on the left, centered title.
          Padding(
            padding: const EdgeInsets.fromLTRB(
              NhamSpacing.sp2,
              NhamSpacing.sp2,
              NhamSpacing.sp2,
              NhamSpacing.sp1,
            ),
            child: Row(
              children: [
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(LucideIcons.x, size: 22),
                  color: NhamColors.textMuted,
                  tooltip: tr('common.cancel'),
                ),
                Expanded(
                  child: Center(
                    child: Text(
                      tr('nutrition.suggestedFoods.title'),
                      style: dashBody(weight: FontWeight.w600),
                    ),
                  ),
                ),
                const SizedBox(width: 48, height: 48),
              ],
            ),
          ),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              padding: EdgeInsets.fromLTRB(
                NhamSpacing.sp4,
                NhamSpacing.sp1,
                NhamSpacing.sp4,
                bottomInset + NhamSpacing.sp5,
              ),
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: NhamSpacing.sp4),
                  child: Text(
                    tr('nutrition.suggestedFoods.subtitle'),
                    style: dashMeta(),
                  ),
                ),
                for (var i = 0; i < nutrients.length; i++) ...[
                  if (i > 0) const SizedBox(height: NhamSpacing.sp5),
                  _NutrientFoods(card: nutrients[i]),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NutrientFoods extends ConsumerWidget {
  const _NutrientFoods({required this.card});

  final NutrientCardData card;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(foodCandidatesProvider(card.nutrient));
    final pct = card.percentOfTarget;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Nutrient header — name, % of target, and the FAO/WHO-class source.
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(
              child: Text(tr(card.labelKey), style: dashBody(weight: FontWeight.w600)),
            ),
            const SizedBox(width: NhamSpacing.sp2),
            if (pct != null)
              Text(
                tr('nutrition.focus.percentOfTarget',
                    namedArgs: {'value': pct.round().toString()}),
                style: dashMeta(tabular: true),
              ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          tr(card.targetSourceLabelKey),
          style: dashEyebrow(color: kInkDisabled),
        ),
        const SizedBox(height: NhamSpacing.sp3),
        async.when(
          loading: () => Padding(
            padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp3),
            child: Text(tr('nutrition.candidates.loading'), style: dashMeta()),
          ),
          error: (_, __) => Padding(
            padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp3),
            child: Text(tr('nutrition.candidates.error'), style: dashMeta()),
          ),
          data: (response) {
            final candidates = response?.candidates ?? const [];
            if (candidates.isEmpty) {
              return Text(tr('nutrition.candidates.empty'), style: dashMeta());
            }
            return Column(
              children: [
                for (var i = 0; i < candidates.length; i++) ...[
                  if (i > 0) const SizedBox(height: NhamSpacing.sp2),
                  FoodCandidateRow(candidate: candidates[i]),
                ],
              ],
            );
          },
        ),
      ],
    );
  }
}
