import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../data/session_provider.dart';
import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../shared/widgets/nham_primitives.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../shell/app_header.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../providers/nutrition_overview_provider.dart';
import '../widgets/day_summary.dart';
import '../widgets/empty_state.dart';
import '../widgets/inline_error.dart';
import '../widgets/nutrient_grid_card.dart';
import '../widgets/nutrition_skeleton.dart';
import '../widgets/range_selector.dart';
import '../widgets/source_attribution.dart';
import '../widgets/suggested_foods_sheet.dart';

/// Nutrition screen — a dense, single-view micronutrient overview. A compact
/// calorie/macro summary, then every tracked nutrient in a 2-column grid grouped
/// by Vitamins / Minerals (progress shown inline, met nutrients greened), a
/// FAO/WHO source line, and one CTA: suggested foods for the timeline's gaps.
///
/// The timeframe toggle (Today / 7d / 30d) lives in the header beside the menu.
class NutritionScreen extends ConsumerStatefulWidget {
  const NutritionScreen({super.key});

  @override
  ConsumerState<NutritionScreen> createState() => _NutritionScreenState();
}

class _NutritionScreenState extends ConsumerState<NutritionScreen> {
  NutritionRangeInput _range = NutritionRangeInput.auto;
  // The card opens on the informative complete-day average; the user can flip to
  // "all days" via the in-card swap.
  NutritionDayScope _dayScope = NutritionDayScope.complete;

  NutritionOverviewArg get _arg => (range: _range, scope: _dayScope);

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(currentSessionProvider);
    final userId = session?.user.id;

    if (userId == null) {
      return Screen(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: NhamText(
              tr('common.notSignedIn'),
              variant: NhamTextVariant.small,
            ),
          ),
        ),
      );
    }

    // A refetch that fails while we still hold a prior overview keeps the
    // content on screen (copyWithPrevious) and surfaces the failure as a top
    // toast instead of nuking what the user is reading.
    ref.listen<AsyncValue<NutritionOverview>>(
      nutritionOverviewProvider(_arg),
      (prev, next) {
        if (next.hasError && next.hasValue) {
          showTopToast(
            context,
            tr('nutrition.errors.overviewToast'),
            variant: TopToastVariant.error,
          );
        }
      },
    );

    final async = ref.watch(nutritionOverviewProvider(_arg));
    // `isFetching`: a refetch in flight while previous data is shown.
    final isFetching = async.isLoading && async.hasValue;

    return Screen(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: AppHeader(
              trailing: NutritionRangeSelector(
                resolvedRange: async.valueOrNull?.resolvedRange ?? '7d',
                onRangeChange: (range) => setState(() => _range = range),
                disabled: isFetching,
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref
                  .read(nutritionOverviewProvider(_arg).notifier)
                  .refetch(),
              color: NhamColors.accent,
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                child: _buildBody(async, isFetching),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(AsyncValue<NutritionOverview> async, bool isFetching) {
    if (async.isLoading && !async.hasValue) {
      return const NutritionSkeleton();
    }

    final overview = async.valueOrNull;
    if (overview == null) {
      return InlineError(
        isRetrying: isFetching,
        message: tr('nutrition.errors.overview'),
        retryLabel: tr('nutrition.errors.retry'),
        onRetry: () {
          ref.read(nutritionOverviewProvider(_arg).notifier).refetch();
        },
      );
    }

    if (overview.loggedDays == 0) {
      return const Padding(
        padding: EdgeInsets.only(top: 48),
        child: EmptyState(),
      );
    }

    final all = [...overview.micronutrients, ...overview.moreNutrients];
    final vitamins =
        all.where((c) => c.group == NutrientGroup.vitamin).toList();
    final minerals =
        all.where((c) => c.group != NutrientGroup.vitamin).toList();
    final foodNutrients = suggestedFoodNutrients(overview);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DaySummary(
          macros: overview.macros,
          resolvedRange: overview.resolvedRange,
          daySeries: overview.daySeries,
          calorieAverages: overview.calorieAverages,
          scope: _dayScope,
          onScopeChange: (scope) => setState(() => _dayScope = scope),
        ),
        // The single CTA sits right under the summary so it's visible on load,
        // not buried below the full nutrient grid.
        if (foodNutrients.isNotEmpty) ...[
          const SizedBox(height: 12),
          _SuggestedFoodsButton(
            onTap: () =>
                showSuggestedFoodsSheet(context, nutrients: foodNutrients),
          ),
        ],
        if (vitamins.isNotEmpty) ...[
          const SizedBox(height: 28),
          _GroupHeader(label: tr('nutrition.nutrientGroups.vitamins')),
          const SizedBox(height: 12),
          _NutrientGrid(cards: vitamins),
        ],
        if (minerals.isNotEmpty) ...[
          const SizedBox(height: 28),
          _GroupHeader(label: tr('nutrition.nutrientGroups.minerals')),
          const SizedBox(height: 12),
          _NutrientGrid(cards: minerals),
        ],
        const SizedBox(height: 24),
        const SourceAttribution(),
      ],
    );
  }
}

class _GroupHeader extends StatelessWidget {
  const _GroupHeader({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(label.toUpperCase(), style: dashEyebrow());
  }
}

/// A 2-column grid of [NutrientGridCard]s — bars stagger in left-to-right,
/// top-to-bottom for a gentle fill.
class _NutrientGrid extends StatelessWidget {
  const _NutrientGrid({required this.cards});

  final List<NutrientCardData> cards;

  @override
  Widget build(BuildContext context) {
    const gap = 12.0;
    final rows = <Widget>[];
    for (var i = 0; i < cards.length; i += 2) {
      final left = cards[i];
      final right = i + 1 < cards.length ? cards[i + 1] : null;
      rows.add(
        Padding(
          padding: EdgeInsets.only(top: i == 0 ? 0 : gap),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: NutrientGridCard(
                  card: left,
                  barDelay: Duration(milliseconds: 60 * i),
                ),
              ),
              const SizedBox(width: gap),
              Expanded(
                child: right == null
                    ? const SizedBox.shrink()
                    : NutrientGridCard(
                        card: right,
                        barDelay: Duration(milliseconds: 60 * (i + 1)),
                      ),
              ),
            ],
          ),
        ),
      );
    }
    return Column(children: rows);
  }
}

/// The single nutrition CTA — opens the suggested-foods sheet.
class _SuggestedFoodsButton extends StatefulWidget {
  const _SuggestedFoodsButton({required this.onTap});

  final VoidCallback onTap;

  @override
  State<_SuggestedFoodsButton> createState() => _SuggestedFoodsButtonState();
}

class _SuggestedFoodsButtonState extends State<_SuggestedFoodsButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1,
        duration: const Duration(milliseconds: 120),
        child: Container(
          height: 52,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: NhamColors.btn,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(LucideIcons.sparkles, size: 18, color: NhamColors.surface),
              const SizedBox(width: NhamSpacing.sp2),
              Text(
                tr('nutrition.suggestedFoods.button'),
                style: dashBody(color: NhamColors.surface, weight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
