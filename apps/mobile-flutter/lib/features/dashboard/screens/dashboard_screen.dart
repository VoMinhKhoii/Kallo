/// DashboardScreen — RN port of `app/(app)/(tabs)/dashboard.tsx`.
///
/// A vertically scrolling stack of the three web sections, in the web's order:
///   1. TODAY SUMMARY  — week title + the calorie-ring / macros / meals dock
///   2. PROGRESS       — "Progress" + 30-day badge + the WeightChart card
///   3. CONSISTENCY    — "Consistency" + 90-day badge + AdherenceHeatmap
///
/// One aggregate fetch ([dashboardBundleProvider]) seeds the per-section
/// providers; sections render only after it resolves, so they hit the warm
/// cache (one request, one cold-start). Mobile deviations match the RN plan:
/// the range badges are passive labels, fixed at 30d/90d.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/profile/dashboard.dart';
import '../../../shared/widgets/brand/kallo_wordmark.dart';
import '../../../shared/widgets/feedback/kallo_refresh.dart';
import '../../../shared/widgets/feedback/skeleton.dart';
import '../../../shared/widgets/surface/kallo_screen.dart';
import '../../../shared/widgets/surface/scroll_separator.dart';
import '../../../shared/widgets/typography/section_header_row.dart';
import '../widgets/states/card_skeletons.dart';
import '../widgets/states/section_state.dart';
import '../../../services/auth/session_provider.dart';
import '../../../shell/header/app_header.dart';
import '../../../shell/header/profile_avatar_button.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';
import '../../logging/logic/timeline_utils.dart' hide WeekStrip;
import '../data/dashboard_providers.dart';
import '../logic/day_window.dart';
import '../../../shared/logic/display_format.dart';
import '../logic/dashboard_spacing.dart';
import '../widgets/heatmap/adherence_heatmap.dart';
import '../../../theme/calm_tokens.dart';
import '../widgets/today/dock_targets.dart';
import '../widgets/today/day_pager.dart';
import '../widgets/today/today_section.dart';
import '../widgets/chrome/week_strip.dart';
import '../widgets/weight/weight_chart.dart';

// EN copy (messages/en.json `dashboard.*`), matching the RN inlined COPY.

// Web DEFAULT_PROFILE fallbacks so an incomplete-onboarding profile never /0g.
const _defaultCalorieTarget = 2000.0;
const _defaultProteinTargetG = 150.0;
const _defaultCarbsTargetG = 250.0;
const _defaultFatTargetG = 65.0;

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(currentSessionProvider);
    final userId = session?.user.id;

    if (userId == null) {
      return Screen(
        bottom: false,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(KalloSpacing.sp6),
            child: Text(
              tr('common.notSignedIn'),
              style: dashBody(color: kInkMuted),
            ),
          ),
        ),
      );
    }

    final todayDate = todayDateString();
    final args = (userId: userId, date: todayDate);
    final bundle = ref.watch(dashboardBundleProvider(args));
    // Awaiting the refetch is what makes the spinner honest: it lives exactly
    // as long as the load it stands for. The skeleton pulls the same one — a
    // first load that hangs is where a pull is most wanted.
    Future<void> refresh() => ref.refresh(dashboardBundleProvider(args).future);

    return Screen(
      bottom: false,
      child: ScrollSeparator(
        header: const Padding(
          padding: EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
          child: AppHeader(
            // Wordmark hard left, avatar hard right: the leading slot is
            // collapsed so the mark starts at the page inset rather than
            // 44pt in behind an empty spacer.
            leading: SizedBox.shrink(),
            // Settings moved behind the avatar when the drawer retired.
            trailing: ProfileAvatarButton(),
            child: Align(
              alignment: Alignment.centerLeft,
              child: KalloWordmark(height: _wordmarkHeight),
            ),
          ),
        ),
        child: bundle.when(
          // Skeleton of the real layout, not a spinner, so the load previews
          // its own shape; one outer pulse keeps nested pulses in phase.
          loading:
              () => SkeletonPulse(child: DashboardSkeleton(onRefresh: refresh)),
          error:
              (_, __) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(KalloSpacing.sp6),
                  child: SectionState(
                    icon: LucideIcons.cloudOff300,
                    message: tr('dashboard.todayLoadError'),
                    actionLabel: tr('dashboard.retry'),
                    onAction:
                        () => ref.invalidate(dashboardBundleProvider(args)),
                  ),
                ),
              ),
          data:
              (data) => _Content(
                args: args,
                todayDate: todayDate,
                targets: _targetsFor(data),
                isFirstRun: _isFirstRun(data),
                onRefresh: refresh,
              ),
        ),
      ),
    );
  }

  /// True when the user looks brand-new — so the dashboard can collapse to
  /// the one first-run card and suppress the "% on track" framing.
  ///
  /// There is no explicit "has-logged-before" flag on the bundle, so this gates
  /// on "zero meals today AND zero logged/partial heatmap cells in the 90d
  /// window". Known limit: a returning user whose last meal is older than 90
  /// days has no cells in the window and IS treated as first-run — acceptable,
  /// since after that long a gentle restart reads better than stale framing.
  bool _isFirstRun(DashboardBundle data) {
    if (data.day.persistedMeals.isNotEmpty) return false;
    for (final row in data.heatmap.cells) {
      for (final cell in row) {
        if (cell.status == HeatmapCellStatus.logged ||
            cell.status == HeatmapCellStatus.partial) {
          return false;
        }
      }
    }
    return true;
  }

  DockTargets _targetsFor(DashboardBundle data) {
    final p = data.profile;
    return DockTargets(
      calorieTarget: p?.calorieTarget ?? _defaultCalorieTarget,
      proteinTargetG: p?.proteinTargetG ?? _defaultProteinTargetG,
      carbsTargetG: p?.carbsTargetG ?? _defaultCarbsTargetG,
      fatTargetG: p?.fatTargetG ?? _defaultFatTargetG,
      // Null until onboarding sets it; the dial reads that as counting up.
      goal: p?.goal,
    );
  }
}

/// Optical height of the masthead wordmark, matching the header line the
/// serif setting used to occupy.
const double _wordmarkHeight = 26;

class _Content extends StatefulWidget {
  const _Content({
    required this.args,
    required this.todayDate,
    required this.targets,
    required this.isFirstRun,
    required this.onRefresh,
  });

  /// Pull-to-refresh: refetches the one aggregate the whole screen reads.
  final Future<void> Function() onRefresh;

  /// Today-anchored args — Progress (30d), Consistency (90d) and the week
  /// strip's rings stay "as of today" regardless of the selected day.
  final DashboardArgs args;
  final String todayDate;
  final DockTargets targets;
  final bool isFirstRun;

  @override
  State<_Content> createState() => _ContentState();
}

class _ContentState extends State<_Content> {
  // The day whose summary the Today card shows; tapping a strip day or swiping
  // the card changes it. The window is unbounded into the past and clamped at
  // today, so pages map to dates through `logic/day_window.dart` instead of
  // indexing a fixed list — today is [kDayPageBase], the last page.
  int _page = kDayPageBase;
  final PageController _pageController = PageController(
    initialPage: kDayPageBase,
  );

  String get _selectedDate => dateForDayPage(widget.todayDate, _page);

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  /// Strip tap → animate the day card to that page (selection haptic fires in
  /// the strip's own GestureDetector). Days after today have no page.
  void _onSelectDay(String date) {
    final page = dayPageForDate(widget.todayDate, date);
    if (page == _page || page < 0 || page > kDayPageBase) return;
    // Animating across many pages builds every intermediate day, and each one
    // fetches `/api/v1/logging/day` — jump straight there beyond a neighbour.
    if ((page - _page).abs() > 1) {
      _pageController.jumpToPage(page);
      return;
    }
    _pageController.animateToPage(
      page,
      duration: KalloMotion.page,
      curve: KalloEase.decelerate,
    );
  }

  /// Swipe → update selection + fire the same selection haptic the strip uses.
  void _onPageChanged(int page) {
    if (page == _page) return;
    HapticFeedback.selectionClick();
    setState(() => _page = page);
  }

  /// A human date line for the card: "Today" / "Yesterday" / a localized
  /// weekday-month-day (e.g. "Mon, Jun 9").
  String _dateLabel(String date, String locale) {
    if (date == widget.todayDate) return tr('dashboard.today');
    if (date == addDays(widget.todayDate, -1)) {
      return tr('dashboard.yesterday');
    }
    return DateFormat('EEE, MMM d', locale).format(dateStringToDate(date));
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();

    // The shared refreshable page scroll: bouncing physics and the refresh
    // control as the first sliver, so the page holds down for the whole
    // refetch — see [KalloRefreshableScroll].
    return KalloRefreshableScroll(
      onRefresh: widget.onRefresh,
      slivers: (bottomInset) => [
        SliverPadding(
          padding: EdgeInsets.only(
            left: KalloSpacing.sp3,
            right: KalloSpacing.sp3,
            // AppHeader already pays sp1 below itself; sp2 here nets the one
            // 12px step between the wordmark and the week strip.
            top: KalloSpacing.sp2,
            // The floating pill nav is not part of the layout (the shell runs
            // extendBody), so it arrives as the body's bottom padding — its
            // MEASURED height, on this device, with this home indicator.
            bottom: bottomInset,
          ),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              // SECTION 1 — week strip + the paged day-viewer (the wordmark
              // lives in the header row, beside the avatar).
              WeekStrip(
                args: widget.args,
                todayDate: widget.todayDate,
                selectedDate: _selectedDate,
                onSelectDay: _onSelectDay,
              ),
              // No trailing margin: each _Section below pays its own break.
              if (widget.isFirstRun)
                TodaySection(
                  args: widget.args,
                  targets: widget.targets,
                  dateLabel: _dateLabel(widget.todayDate, locale),
                  isFirstRun: true,
                )
              else
                DayPager(
                  controller: _pageController,
                  dateForPage: (p) => dateForDayPage(widget.todayDate, p),
                  todayPage: kDayPageBase,
                  userId: widget.args.userId,
                  targets: widget.targets,
                  onPageChanged: _onPageChanged,
                  dateLabel: (d) => _dateLabel(d, locale),
                ),
              // SECTION 2 — Progress.
              _Section(
                children: [
                  SectionHeaderRow(
                    title: tr('dashboard.progress'),
                    meta: tr('dashboard.ranges.thirtyDays'),
                  ),
                  WeightChart(args: widget.args),
                ],
              ),
              // SECTION 3 — Consistency. The padding's bottom is the nav
              // clearance, so the scroll ends right under the heatmap.
              _Section(
                children: [
                  SectionHeaderRow(
                    title: tr('dashboard.consistency'),
                    meta: tr('dashboard.ranges.ninetyDays'),
                  ),
                  AdherenceHeatmap(args: widget.args),
                ],
              ),
            ]),
          ),
        ),
      ],
    );
  }
}

/// A dashboard section: header + card, bound together on the
/// [DashboardSpacing.block] rhythm and pushed away from whatever precedes them
/// by [DashboardSpacing.sectionBreak].
///
/// The break is paid on TOP, by the section that needs it, rather than as a
/// trailing margin on the block above — so a section is separated by the fact
/// of being one, and the last section needs no special case to avoid a dead
/// gap under the scroll.
class _Section extends StatelessWidget {
  const _Section({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: DashboardSpacing.sectionBreak),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(height: DashboardSpacing.block),
            children[i],
          ],
        ],
      ),
    );
  }
}
