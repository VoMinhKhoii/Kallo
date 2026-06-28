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

/// The under-target, candidate-supported nutrients from an overview, most
/// in-need first — the input to the suggested-foods CTA. Mirrors the web
/// `showChips` gate (supported · confidence ≥ 40 · < 90% of target).
List<NutrientCardData> suggestedFoodNutrients(NutritionOverview overview) {
  final all = [...overview.micronutrients, ...overview.moreNutrients];
  final eligible = all.where(showChips).toList()
    ..sort(
      (a, b) => (a.percentOfTarget ?? 0).compareTo(b.percentOfTarget ?? 0),
    );
  return eligible.take(5).toList();
}

/// The single nutrition CTA: a compact list of the nutrients you're short on —
/// which one, by how much, and a few ingredients that close the gap.
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
    final maxHeight = MediaQuery.of(context).size.height * 0.8;

    return Container(
      constraints: BoxConstraints(maxHeight: maxHeight),
      decoration: const BoxDecoration(
        color: NhamColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(NhamRadii.xxl)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
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
            child: ListView.separated(
              shrinkWrap: true,
              padding: EdgeInsets.fromLTRB(
                NhamSpacing.sp4,
                NhamSpacing.sp1,
                NhamSpacing.sp4,
                bottomInset + NhamSpacing.sp5,
              ),
              itemCount: nutrients.length,
              separatorBuilder: (_, __) => const Divider(
                height: NhamSpacing.sp5,
                thickness: 1,
                color: NhamColors.borderFaint,
              ),
              itemBuilder: (_, i) => _NutrientGap(card: nutrients[i]),
            ),
          ),
        ],
      ),
    );
  }
}

class _NutrientGap extends ConsumerWidget {
  const _NutrientGap({required this.card});

  final NutrientCardData card;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(foodCandidatesProvider(card.nutrient));
    final pct = card.percentOfTarget;
    final shortBy = pct == null ? null : (100 - pct).round();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Which nutrient + by how much you're short.
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(
              child: Text(tr(card.labelKey), style: dashBody(weight: FontWeight.w600)),
            ),
            const SizedBox(width: NhamSpacing.sp2),
            if (shortBy != null)
              Text(
                tr('nutrition.suggestedFoods.short',
                    namedArgs: {'value': shortBy.toString()}),
                style: dashMeta(color: NhamColors.danger, tabular: true),
              ),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp2_5),
        // Which ingredients close the gap.
        async.when(
          loading: () => Text(
            tr('nutrition.candidates.loading'),
            style: dashMeta(color: kInkDisabled),
          ),
          error: (_, __) => Text(
            tr('nutrition.candidates.error'),
            style: dashMeta(color: kInkDisabled),
          ),
          data: (response) {
            final names = (response?.candidates ?? const [])
                .take(5)
                .map((c) => tr(c.nameKey))
                .toList();
            if (names.isEmpty) {
              return Text(tr('nutrition.candidates.empty'),
                  style: dashMeta(color: kInkDisabled));
            }
            return Wrap(
              spacing: NhamSpacing.sp2,
              runSpacing: NhamSpacing.sp2,
              children: [for (final n in names) _FoodChip(name: n)],
            );
          },
        ),
      ],
    );
  }
}

class _FoodChip extends StatelessWidget {
  const _FoodChip({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: kFieldFill,
        borderRadius: BorderRadius.circular(NhamRadii.pill),
        border: Border.all(color: NhamColors.borderSoft),
      ),
      child: Text(name, style: dashMeta(color: kInk)),
    );
  }
}
