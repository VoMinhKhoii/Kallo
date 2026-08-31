import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/surface/scroll_separator.dart';
import '../../../services/auth/session_provider.dart';
import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition/nutrition.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/feedback/kallo_refresh.dart';
import '../../../shared/widgets/typography/kallo_text.dart';
import '../../../shared/widgets/typography/section_header_row.dart';
import '../../../shared/widgets/toast/top_toast.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/bucket_detail.dart';
import '../logic/helpers.dart';
import '../providers/nutrition_overview_provider.dart';
import '../widgets/summary/day_summary.dart';
import '../widgets/states/empty_state.dart';
import '../widgets/states/inline_error.dart';
import '../widgets/nutrients/macro_rows_card.dart';
import '../widgets/nutrients/nutrient_rows_card.dart';
import '../widgets/states/micronutrients_locked_card.dart';
import '../widgets/states/nutrition_skeleton.dart';
import '../widgets/scope/range_selector.dart';
import '../widgets/nutrients/source_attribution.dart';
import '../widgets/nutrients/suggested_foods_sheet.dart';

/// Whether the suggested-foods CTA is offered.
///
/// Hidden for now. The sheet, its provider and its copy stay wired, so bringing
/// it back is this one flip rather than a rebuild.
const bool kShowSuggestedFoods = false;

/// Nutrition screen — a single-view overview of the period: the calorie card
/// with its stacked macro-calorie chart, the three macros as grouped rows, and
/// every tracked nutrient as grouped rows under Vitamins / Minerals, closing
/// on the FAO/WHO source line.
///
/// The page title carries the timeframe toggle (7 / 30 / 90 days) on its own
/// row — there is no app header here; the page IS its title.
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

  /// The page's ONE vertical step — header to card, card to header. 12 is
  /// the app-wide rhythm; the 17/600 section headers carry the boundaries
  /// that a bigger gap used to.
  static const double _gap = KalloSpacing.sp3;

  void _clearSelection() {
    if (_selectedIndex != null) setState(() => _selectedIndex = null);
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(currentSessionProvider);
    final userId = session?.user.id;

    if (userId == null) {
      return Screen(
        bottom: false,
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
      bottom: false,
      child: ScrollSeparator(
        header: Padding(
          padding: const EdgeInsets.fromLTRB(
            KalloSpacing.sp3,
            0,
            KalloSpacing.sp3,
            KalloSpacing.sp3,
          ),
          child: Row(
            children: [
              // Shrink-to-fit, never ellipsis: the title row gives the 216pt
              // range control its width first, and "Dinh dưỡng" is wider than
              // "Nutrition" — a clipped page title is worse than a slightly
              // smaller one, and the same rule the segments themselves follow.
              Expanded(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    tr('nutrition.title'),
                    maxLines: 1,
                    softWrap: false,
                    style: kPageTitle(),
                  ),
                ),
              ),
              const SizedBox(width: KalloSpacing.sp2),
              NutritionRangeSelector(
                // An explicit pick highlights immediately. Reading the server's
                // `resolvedRange` alone meant the segment only moved once the
                // refetch landed, and with nothing cached for the new selection
                // the fallback below flashed 7d on the way from 30d to 90d.
                // `auto` still defers — that is the whole point of it.
                resolvedRange:
                    _range == NutritionRangeInput.auto
                        ? (async.valueOrNull?.resolvedRange ?? '7d')
                        : _range.value,
                onRangeChange:
                    (range) => setState(() {
                      _range = range;
                      _selectedIndex = null;
                    }),
                disabled: isFetching,
              ),
            ],
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
                    0,
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
                  // The tail clears the floating pill nav — this is a tab, and
                  // the bar hovers over the last thing on the page.
                  padding: EdgeInsets.fromLTRB(
                    KalloSpacing.sp3,
                    KalloSpacing.sp5,
                    KalloSpacing.sp3,
                    kNavClearance,
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
    final detail =
        _selectedIndex == null
            ? null
            : buildBucketDetail(overview.daySeries, _selectedIndex!);
    final active = detail == null ? null : _selectedIndex;
    final macros =
        detail == null
            ? overview.macros
            : scopeMacrosToBucket(overview.macros, detail);
    final all =
        detail == null
            ? [...overview.micronutrients, ...overview.moreNutrients]
            : scopeCardsToBucket([
              ...overview.micronutrients,
              ...overview.moreNutrients,
            ], detail);
    final vitamins =
        all.where((c) => c.group == NutrientGroup.vitamin).toList();
    final minerals =
        all.where((c) => c.group != NutrientGroup.vitamin).toList();
    // The CTA is off, so its input is not worth computing on every build.
    final foodNutrients =
        kShowSuggestedFoods
            ? suggestedFoodNutrients(overview)
            : const <NutrientCardData>[];
    final buckets =
        overview.daySeries.series.isEmpty
            ? const <DaySeriesBucket>[]
            : overview.daySeries.series.first.buckets;
    final locale = context.locale.toString();
    final dateSpan =
        detail == null
            ? formatDateSpan(
              overview.period.startDate,
              overview.period.endDate,
              locale,
            )
            : formatDateSpan(detail.startDate, detail.endDate, locale);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The section header names the scope the figure is averaged over. The
        // unit used to carry it ("kcal per complete day"); saying it once here
        // keeps the figure clean without leaving the scope inferable only from
        // a button that names the OTHER one. A selected column is that bucket,
        // not an average over a day scope, so it drops the qualifier.
        SectionHeaderRow(
          title: tr('nutrition.macros.calories'),
          meta:
              active != null
                  ? tr('nutrition.cardTitle')
                  : '${tr('nutrition.cardTitle')} · '
                      '${tr(overview.loggedDays == 0 || _dayScope == NutritionDayScope.all ? 'nutrition.rhythm.loggedDays' : 'nutrition.rhythm.completeDays')}',
        ),
        const SizedBox(height: _gap),
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
          onSelect:
              (index) => setState(
                () => _selectedIndex = _selectedIndex == index ? null : index,
              ),
          isEmpty: overview.loggedDays == 0,
        ),
        // The three macros belong to the calorie section — same average, same
        // scope, broken out — so they carry no header of their own.
        const SizedBox(height: _gap),
        MacroRowsCard(macros: macros),
        // Nothing logged yet: the page keeps its shape at zero, and the prompt
        // sits under the card rather than replacing everything — so the layout
        // someone will use every day is the first thing they see.
        if (overview.loggedDays == 0) ...[
          const SizedBox(height: _gap),
          const EmptyState(),
        ],
        // The single CTA sits right under the summary so it's visible on load,
        // not buried below the full nutrient list.
        if (kShowSuggestedFoods && foodNutrients.isNotEmpty) ...[
          const SizedBox(height: _gap),
          // The in-app primary tier — beige + ink, fully rounded — not a
          // bespoke umber pill.
          KalloButton(
            title: tr('nutrition.suggestedFoods.button'),
            onPressed:
                () =>
                    showSuggestedFoodsSheet(context, nutrients: foodNutrients),
          ),
        ],
        if (overview.micronutrientsLocked) const MicronutrientsLockedCard(),
        ..._group(tr('nutrition.nutrientGroups.vitamins'), vitamins),
        ..._group(tr('nutrition.nutrientGroups.minerals'), minerals),
      ],
    );
  }

  /// One nutrient group: its header, and its rows as a grouped card.
  ///
  /// The header's meta says "Limited data" when anything in the group is too
  /// thinly covered to trust — said once for the group rather than repeated as
  /// a caveat on every row it applies to.
  List<Widget> _group(String title, List<NutrientCardData> cards) {
    if (cards.isEmpty) return const [];
    return [
      const SizedBox(height: _gap),
      SectionHeaderRow(
        title: title,
        meta:
            cards.any((c) => isLowConfidence(c.displayState))
                ? tr('nutrition.summary.limitedData')
                : null,
      ),
      const SizedBox(height: _gap),
      NutrientRowsCard(cards: cards),
    ];
  }
}
