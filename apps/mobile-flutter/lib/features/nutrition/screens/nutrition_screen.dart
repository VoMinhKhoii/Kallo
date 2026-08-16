import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/scroll_separator.dart';
import '../../../data/session_provider.dart';
import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../shared/widgets/kallo_primitives.dart';
import '../../../shared/widgets/kallo_refresh.dart';
import '../../../shared/widgets/kallo_text.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../shell/app_header.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/bucket_detail.dart';
import '../providers/nutrition_overview_provider.dart';
import '../widgets/day_summary.dart';
import '../widgets/empty_state.dart';
import '../widgets/inline_error.dart';
import '../widgets/nutrient_grid_card.dart';
import '../widgets/nutrition_skeleton.dart';
import '../widgets/range_selector.dart';
import '../widgets/source_attribution.dart';
import '../widgets/suggested_foods_sheet.dart';

/// Whether the suggested-foods CTA is offered.
///
/// Hidden for now. The sheet, its provider and its copy stay wired, so bringing
/// it back is this one flip rather than a rebuild.
const bool kShowSuggestedFoods = false;

/// Nutrition screen — a dense, single-view micronutrient overview. A compact
/// calorie/macro summary, then every tracked nutrient in a 2-column grid grouped
/// by Vitamins / Minerals (progress shown inline, met nutrients greened) and a
/// FAO/WHO source line.
///
/// The timeframe toggle (7 / 30 / 90 days) lives in the header beside the menu.
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

  /// The tapped chart column, if any. Selecting one re-points the WHOLE page at
  /// that bucket — the calorie hero, the gram legend and the nutrient grid —
  /// rather than opening a second panel repeating them.
  int? _selectedIndex;

  NutritionOverviewArg get _arg => (range: _range, scope: _dayScope);

  void _clearSelection() {
    if (_selectedIndex != null) setState(() => _selectedIndex = null);
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(currentSessionProvider);
    final userId = session?.user.id;

    if (userId == null) {
      return Screen(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: KalloText(
              tr('common.notSignedIn'),
              variant: KalloTextVariant.small,
            ),
          ),
        ),
      );
    }

    // A refetch that fails while we still hold a prior overview keeps the
    // content on screen (copyWithPrevious) and surfaces the failure as a top
    // toast instead of nuking what the user is reading.
    ref.listen<AsyncValue<NutritionOverview>>(nutritionOverviewProvider(_arg), (
      prev,
      next,
    ) {
      if (next.hasError && next.hasValue) {
        showTopToast(
          context,
          tr('nutrition.errors.overviewToast'),
          variant: TopToastVariant.error,
        );
      }
    });

    final async = ref.watch(nutritionOverviewProvider(_arg));
    // `isFetching`: a refetch in flight while previous data is shown.
    final isFetching = async.isLoading && async.hasValue;

    return Screen(
      child: ScrollSeparator(
        header: Padding(
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
          child: AppHeader(
            trailing: NutritionRangeSelector(
              // An explicit pick highlights immediately. Reading the server's
              // `resolvedRange` alone meant the segment only moved once the
              // refetch landed, and with nothing cached for the new selection
              // the fallback below flashed 7d on the way from 30d to 90d.
              // `auto` still defers — that is the whole point of it.
              resolvedRange: _range == NutritionRangeInput.auto
                  ? (async.valueOrNull?.resolvedRange ?? '7d')
                  : _range.value,
              onRangeChange: (range) => setState(() {
                _range = range;
                _selectedIndex = null;
              }),
              disabled: isFetching,
            ),
          ),
        ),
        child: KalloRefresh(
          onRefresh:
              () =>
                  ref.read(nutritionOverviewProvider(_arg).notifier).refetch(),
          child: GestureDetector(
            behavior: HitTestBehavior.translucent,
            onTap: _clearSelection,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    KalloSpacing.sp3,
                    KalloSpacing.sp4,
                    KalloSpacing.sp3,
                    0,
                  ),
                  sliver: SliverToBoxAdapter(
                    child: _buildBody(async, isFetching),
                  ),
                ),
                // The source line belongs to the PAGE, not to the section above
                // it. `hasScrollBody: false` hands this sliver whatever height
                // is left over, so the line sits on the bottom edge on a short
                // page and simply follows the content on a long one.
                const SliverPadding(
                  padding: EdgeInsets.fromLTRB(
                    KalloSpacing.sp3,
                    KalloSpacing.sp5,
                    KalloSpacing.sp3,
                    KalloSpacing.sp10,
                  ),
                  sliver: SliverFillRemaining(
                    hasScrollBody: false,
                    child: Align(
                      alignment: Alignment.bottomCenter,
                      child: SourceAttribution(),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
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

    // `active`, not `_selectedIndex`: tapping a column with nothing logged in
    // it resolves to no detail, and the page stays on the range rather than
    // greying every other column around an empty one.
    final detail = _selectedIndex == null
        ? null
        : buildBucketDetail(overview.daySeries, _selectedIndex!);
    final active = detail == null ? null : _selectedIndex;
    final macros = detail == null
        ? overview.macros
        : scopeMacrosToBucket(overview.macros, detail);
    final all = detail == null
        ? [...overview.micronutrients, ...overview.moreNutrients]
        : scopeCardsToBucket(
            [...overview.micronutrients, ...overview.moreNutrients], detail);
    final vitamins =
        all.where((c) => c.group == NutrientGroup.vitamin).toList();
    final minerals =
        all.where((c) => c.group != NutrientGroup.vitamin).toList();
    // The CTA is off, so its input is not worth computing on every build.
    final foodNutrients = kShowSuggestedFoods
        ? suggestedFoodNutrients(overview)
        : const <NutrientCardData>[];
    final buckets = overview.daySeries.series.isEmpty
        ? const <DaySeriesBucket>[]
        : overview.daySeries.series.first.buckets;
    final locale = context.locale.toString();
    final dateSpan = detail == null
        ? formatDateSpan(
            overview.period.startDate, overview.period.endDate, locale)
        : formatDateSpan(detail.startDate, detail.endDate, locale);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The card names the scope its figure is averaged over. The unit used
        // to carry it ("kcal per complete day"); saying it once here keeps the
        // figure clean without leaving the scope inferable only from a button
        // that names the OTHER one. A selected column is that bucket, not an
        // average over a day scope, so it drops the qualifier.
        _GroupHeader(
          label: active != null
              ? tr('nutrition.cardTitle')
              : '${tr('nutrition.cardTitle')} · '
                  '${tr(overview.loggedDays == 0 || _dayScope == NutritionDayScope.all ? 'nutrition.rhythm.loggedDays' : 'nutrition.rhythm.completeDays')}',
        ),
        const SizedBox(height: 12),
        DaySummary(
          macros: macros,
          resolvedRange: overview.resolvedRange,
          daySeries: overview.daySeries,
          calorieAverages: overview.calorieAverages,
          previousCalorieAverages: overview.previousCalorieAverages,
          scope: _dayScope,
          onScopeChange: (scope) => setState(() => _dayScope = scope),
          dateSpan: dateSpan,
          todayIndex: findTodayIndex(buckets, localIsoDate()),
          selectedIndex: active,
          onSelect: (index) => setState(
              () => _selectedIndex = _selectedIndex == index ? null : index),
          isEmpty: overview.loggedDays == 0,
        ),
        // Nothing logged yet: the page keeps its shape at zero, and the prompt
        // sits under the card rather than replacing everything — so the layout
        // someone will use every day is the first thing they see.
        if (overview.loggedDays == 0) ...[
          const SizedBox(height: 20),
          const EmptyState(),
        ],
        // The single CTA sits right under the summary so it's visible on load,
        // not buried below the full nutrient grid.
        if (kShowSuggestedFoods && foodNutrients.isNotEmpty) ...[
          const SizedBox(height: 12),
          _SuggestedFoodsButton(
            onTap:
                () =>
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
                child:
                    right == null
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
            color: KalloColors.btn,
            borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                LucideIcons.sparkles300,
                size: 18,
                color: KalloColors.surface,
              ),
              const SizedBox(width: KalloSpacing.sp2),
              Text(
                tr('nutrition.suggestedFoods.button'),
                style: dashBody(
                  color: KalloColors.surface,
                  weight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
