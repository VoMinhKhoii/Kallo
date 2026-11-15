import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/surface/scroll_separator.dart';
import '../../../services/auth/session_provider.dart';
import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition/nutrition.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shell/window/window_layout.dart';
import '../../../shared/widgets/feedback/sliver_centered_state.dart';
import '../../../shared/widgets/typography/section_header_row.dart';
import '../../../shared/widgets/toast/top_toast.dart';
import '../../../theme/kallo_theme.dart';
import '../../dashboard/logic/dashboard_spacing.dart';
import '../logic/helpers.dart';
import '../logic/overview_selection.dart';
import '../providers/nutrition_overview_provider.dart';
import '../widgets/summary/day_summary.dart';
import '../widgets/states/empty_state.dart';
import '../widgets/states/inline_error.dart';
import '../widgets/nutrients/macro_rows_card.dart';
import '../widgets/nutrients/nutrient_grid.dart';
import '../widgets/states/micronutrients_locked_card.dart';
import '../widgets/states/nutrition_skeleton.dart';
import '../widgets/scope/range_selector.dart';
import '../widgets/nutrients/source_attribution.dart';
import '../widgets/nutrients/suggested_foods_sheet.dart';
import '../widgets/overview/nutrition_panes.dart';

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

  /// The page's horizontal margin.
  static const double _side = KalloSpacing.sp3;

  void _clearSelection() {
    if (_selectedIndex != null) setState(() => _selectedIndex = null);
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(currentSessionProvider);
    final userId = session?.user.id;

    if (userId == null) {
      return Screen(
        bounded: true,
        glow: true,
        bottom: false,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              tr('common.notSignedIn'),
              style: dashBody(color: kInkMuted),
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
      bounded: true,
      glow: true,
      bottom: false,
      child: ScrollSeparator(
        header: Padding(
          padding: const EdgeInsets.fromLTRB(_side, 0, _side, _side),
          child: Row(
            textDirection:
                WindowLayout.of(context).twoPane &&
                        WindowLayout.of(context).controlEdge == ControlEdge.left
                    ? TextDirection.rtl
                    : TextDirection.ltr,
            children: [
              // Shrink-to-fit, never ellipsis: the title row gives the 216pt
              // range control its width first, and "Dinh dưỡng" is wider than
              // "Nutrition" — a clipped page title is worse than a slightly
              // smaller one, and the same rule the segments themselves follow.
              Expanded(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment:
                      WindowLayout.of(context).twoPane &&
                              WindowLayout.of(context).controlEdge ==
                                  ControlEdge.left
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
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
        child: NutritionPanes(
          onClearSelection: _clearSelection,
          onRefresh:
              () =>
                  ref.read(nutritionOverviewProvider(_arg).notifier).refetch(),
          page: (bottom, near) => _page(async, isFetching, bottom, near),
        ),
      ),
    );
  }

  /// The page, chosen from the async state BEFORE anything is built: skeleton
  /// while the first overview is in flight, the centred failed state when it
  /// never arrived, the content once it has. Deciding here rather than on the
  /// runtime type of a built widget keeps the three pages independent — the
  /// failed one is a different LAYOUT, not the content one with a card in it.
  List<Widget> _page(
    AsyncValue<NutritionOverview> async,
    bool isFetching,
    double bottomInset,
    bool? near,
  ) {
    final overview = async.valueOrNull;
    if (overview != null) {
      return _scrollPage(_buildBody(overview, near), bottomInset, near);
    }
    if (near == true && !async.isLoading) return [];
    if (near == true) {
      return _scrollPage(
        const NutritionSkeleton(nutrientsOnly: true),
        bottomInset,
        near,
      );
    }
    if (async.isLoading) {
      return _scrollPage(
        NutritionSkeleton(caloriesOnly: near == false),
        bottomInset,
        near,
      );
    }
    // The failed page has nothing on it but the state card, so the card sits
    // at the MIDDLE of it rather than under the title with the rest blank —
    // and the source line still holds the bottom edge. One fill sliver does
    // both: two would fight, since the first `hasScrollBody: false` takes
    // everything that is left.
    return [
      SliverCenteredState(
        padding: EdgeInsets.fromLTRB(_side, 0, _side, bottomInset),
        footer: const SourceAttribution(),
        child: InlineError(
          isRetrying: isFetching,
          message: tr('nutrition.errors.overview'),
          retryLabel: tr('nutrition.errors.retry'),
          onRetry: () {
            ref.read(nutritionOverviewProvider(_arg).notifier).refetch();
          },
        ),
      ),
    ];
  }

  /// The scrolling page: [body] under the title, then the source line.
  EdgeInsets _paneInsets(bool? near, double bottom) {
    if (near == null) return EdgeInsets.fromLTRB(_side, 0, _side, bottom);
    final left =
        near == (WindowLayout.of(context).controlEdge == ControlEdge.left);
    return EdgeInsets.fromLTRB(left ? _side : 0, 0, left ? 0 : _side, bottom);
  }

  List<Widget> _scrollPage(Widget body, double bottomInset, bool? near) => [
    SliverPadding(
      padding: _paneInsets(near, 0),
      sliver: SliverToBoxAdapter(child: body),
    ),
    // The source line belongs to the PAGE, not to the section above it — the
    // footer-only tail, so this page and the failed one below pin it the same
    // way and the break above it has one name (`footerGap`).
    SliverCenteredState(
      // The inset clears the floating pill nav — this is a tab, and the bar
      // hovers over the last thing on the page. It is paid INSIDE the fill: a
      // trailing spacer sliver would push the tail off the viewport.
      padding: _paneInsets(near, bottomInset),
      // Once per page. In two panes the targets it credits are the vitamin
      // and mineral ones, so it closes the pane that shows them.
      footer: near == false ? null : const SourceAttribution(),
    ),
  ];

  /// The content page's body. Every figure on it is resolved first — one pass
  /// over the overview and the tapped column — so what follows is layout.
  Widget _buildBody(NutritionOverview overview, bool? near) {
    final view = OverviewSelection.resolve(
      overview,
      selectedIndex: _selectedIndex,
      locale: context.locale.toString(),
    );
    // The CTA is off, so its input is not worth computing on every build.
    final foodNutrients =
        kShowSuggestedFoods
            ? suggestedFoodNutrients(overview)
            : const <NutrientCardData>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (near != true) ...[
          // The section header names the scope the figure is averaged over. The
          // unit used to carry it ("kcal per complete day"); saying it once here
          // keeps the figure clean without leaving the scope inferable only from
          // a button that names the OTHER one. A selected column is that bucket,
          // not an average over a day scope, so it drops the qualifier.
          SectionHeaderRow(
            title: tr('nutrition.macros.calories'),
            meta:
                view.active != null
                    ? tr('nutrition.cardTitle')
                    : '${tr('nutrition.cardTitle')} · '
                        '${tr(overview.loggedDays == 0 || _dayScope == NutritionDayScope.all ? 'nutrition.rhythm.loggedDays' : 'nutrition.rhythm.completeDays')}',
          ),
          const SizedBox(height: _gap),
          DaySummary(
            macros: view.macros,
            resolvedRange: overview.resolvedRange,
            daySeries: overview.daySeries,
            calorieAverages: overview.calorieAverages,
            previousCalorieAverages: overview.previousCalorieAverages,
            scope: _dayScope,
            onScopeChange: (scope) => setState(() => _dayScope = scope),
            dateSpan: view.dateSpan,
            todayIndex: view.todayIndex,
            selectedIndex: view.active,
            onSelect:
                (index) => setState(
                  () => _selectedIndex = _selectedIndex == index ? null : index,
                ),
            isEmpty: overview.loggedDays == 0,
          ),
          // The three macros belong to the calorie section — same average, same
          // scope, broken out — so they carry no header of their own.
          const SizedBox(height: _gap),
          MacroRowsCard(macros: view.macros),
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
                  () => showSuggestedFoodsSheet(
                    context,
                    nutrients: foodNutrients,
                  ),
            ),
          ],
        ],
        if (near != false) ...[
          if (overview.micronutrientsLocked) const MicronutrientsLockedCard(),
          ..._group(
            tr('nutrition.nutrientGroups.vitamins'),
            view.vitamins,
            first: near == true,
          ),
          ..._group(tr('nutrition.nutrientGroups.minerals'), view.minerals),
        ],
      ],
    );
  }

  /// One nutrient group: its header, and its nutrients as a 2-column grid of
  /// cards (2026-09-07 — see [NutrientGridCard] for why the grid came back).
  ///
  /// The header's meta says "Limited data" when anything in the group is too
  /// thinly covered to trust — said once for the group rather than repeated as
  /// a caveat on every cell it applies to.
  List<Widget> _group(
    String title,
    List<NutrientCardData> cards, {
    bool first = false,
  }) {
    if (cards.isEmpty) return const [];
    return [
      // The same asymmetry the dashboard uses: a doubled break above the
      // header, the plain rhythm below it, so the two screens separate their
      // sections the same way.
      if (!first) const SizedBox(height: DashboardSpacing.sectionBreak),
      SectionHeaderRow(
        title: title,
        meta:
            cards.any((c) => isLowConfidence(c.displayState))
                ? tr('nutrition.summary.limitedData')
                : null,
      ),
      const SizedBox(height: _gap),
      NutrientGrid(cards: cards),
    ];
  }
}
