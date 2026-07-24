import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../logic/status.dart';
import '../providers/candidates_response.dart';
import '../providers/food_candidates_provider.dart';
import 'suggested_foods_skeleton.dart';

/// The under-target nutrients from an overview, most in-need first — the input
/// to the suggested-foods CTA (confidence ≥ 40 · < 90% of target).
List<NutrientCardData> suggestedFoodNutrients(NutritionOverview overview) {
  final all = [...overview.micronutrients, ...overview.moreNutrients];
  final eligible = all.where(showChips).toList()
    ..sort(
      (a, b) => (a.percentOfTarget ?? 0).compareTo(b.percentOfTarget ?? 0),
    );
  return eligible.take(5).toList();
}

/// The single nutrition CTA: which nutrients you're short on, by how much, and
/// foods that close the gap. Tap a food to keep it; "Don't have these?" swaps
/// the rest for other options from the same pool (no refetch).
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

class _NutrientGap extends ConsumerStatefulWidget {
  const _NutrientGap({required this.card});

  final NutrientCardData card;

  @override
  ConsumerState<_NutrientGap> createState() => _NutrientGapState();
}

class _NutrientGapState extends ConsumerState<_NutrientGap> {
  static const int _visibleCount = 3;

  final Set<String> _reserved = {};
  int _cursor = 0;

  @override
  Widget build(BuildContext context) {
    final card = widget.card;
    final async = ref.watch(foodCandidatesProvider(card.nutrient));
    final pct = card.percentOfTarget;
    final shortBy = pct == null ? null : (100 - pct).round();
    final vi = context.locale.languageCode == 'vi';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Which nutrient + by how much you're short.
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(
              child: Text(tr(card.labelKey),
                  style: dashBody(weight: FontWeight.w600)),
            ),
            const SizedBox(width: NhamSpacing.sp2),
            if (shortBy != null && shortBy > 0)
              Text(
                tr('nutrition.suggestedFoods.short',
                    namedArgs: {'value': shortBy.toString()}),
                style: dashMeta(color: NhamColors.danger, tabular: true),
              ),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp2_5),
        async.when(
          loading: () => const CandidatesSkeleton(),
          error: (_, __) => Text(tr('nutrition.candidates.error'),
              style: dashMeta(color: kInkMuted)),
          data: (response) => _foods(response, vi),
        ),
      ],
    );
  }

  Widget _foods(CandidatesResponse response, bool vi) {
    final pool = response.foods;
    if (pool.isEmpty) {
      return Text(tr('nutrition.candidates.empty'),
          style: dashMeta(color: kInkMuted));
    }

    final reserved = pool.where((f) => _reserved.contains(f.id)).toList();
    final rest = pool.where((f) => !_reserved.contains(f.id)).toList();
    final rotatingSlots = (_visibleCount - reserved.length).clamp(0, pool.length);

    final rotating = <FoodCandidate>[];
    for (var i = 0; i < rotatingSlots && i < rest.length; i++) {
      rotating.add(rest[(_cursor + i) % rest.length]);
    }
    final visible = [...reserved, ...rotating];
    final canRefresh = rest.length > rotatingSlots;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: NhamSpacing.sp2,
          runSpacing: NhamSpacing.sp2,
          children: [
            for (final f in visible)
              _FoodChip(
                label: vi ? f.name : f.nameEn,
                reserved: _reserved.contains(f.id),
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() {
                    if (!_reserved.add(f.id)) _reserved.remove(f.id);
                  });
                },
              ),
          ],
        ),
        if (canRefresh) ...[
          const SizedBox(height: NhamSpacing.sp2),
          _RefreshButton(
            onTap: () => setState(
              () => _cursor = (_cursor + rotatingSlots) % rest.length,
            ),
          ),
        ],
      ],
    );
  }
}

class _FoodChip extends StatelessWidget {
  const _FoodChip({
    required this.label,
    required this.reserved,
    required this.onTap,
  });

  final String label;
  final bool reserved;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // A long food name can be wider than the row; Wrap can't break inside a
    // child, so cap the chip and let the label ellipsize.
    final maxWidth = MediaQuery.of(context).size.width * 0.62;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        constraints: BoxConstraints(maxWidth: maxWidth),
        padding: EdgeInsets.fromLTRB(
          reserved ? 8 : 10,
          6,
          10,
          6,
        ),
        decoration: BoxDecoration(
          color: reserved ? NhamColors.accent10 : kFieldFill,
          borderRadius: BorderRadius.circular(NhamRadii.pill),
          border: Border.all(
            color: reserved ? NhamColors.accent50 : NhamColors.borderSoft,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (reserved) ...[
              const Icon(LucideIcons.check, size: 13, color: NhamColors.text),
              const SizedBox(width: 4),
            ],
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: dashMeta(color: reserved ? NhamColors.text : kInk),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RefreshButton extends StatelessWidget {
  const _RefreshButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.refreshCw, size: 13, color: kInkMuted),
            const SizedBox(width: 5),
            Text(
              tr('nutrition.suggestedFoods.refresh'),
              style: dashMeta(color: kInkMuted),
            ),
          ],
        ),
      ),
    );
  }
}
