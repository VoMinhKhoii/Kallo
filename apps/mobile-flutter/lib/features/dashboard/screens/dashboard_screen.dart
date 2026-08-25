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
import '../../../shared/widgets/feedback/skeleton.dart';
import '../../../shared/widgets/surface/kallo_screen.dart';
import '../../../shared/widgets/surface/scroll_separator.dart';
import '../widgets/states/card_skeletons.dart';
import '../../../services/auth/session_provider.dart';
import '../../../shell/header/app_header.dart';
import '../../../theme/kallo_theme.dart';
import '../../logging/logic/timeline_utils.dart' hide WeekStrip;
import '../data/dashboard_providers.dart';
import '../../../shared/logic/display_format.dart';
import '../logic/dashboard_spacing.dart';
import '../widgets/heatmap/adherence_heatmap.dart';
import '../../../theme/calm_tokens.dart';
import '../widgets/chrome/floating_meal_trigger.dart';
import '../widgets/chrome/section_header.dart';
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

    return Screen(
      child: ScrollSeparator(
        header: Padding(
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
          child: AppHeader(
            child: Text(_greeting().tr(), style: dashPageTitle()),
          ),
        ),
        child: bundle.when(
          // Skeleton of the real layout, not a spinner, so the load previews
          // its own shape; one outer pulse keeps nested pulses in phase.
          loading: () => const SkeletonPulse(child: DashboardSkeleton()),
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

/// The l10n key for a time-of-day greeting, driven by the device clock. A
/// greeting, not an interpretation — the only Lora moment on the screen.
String _greeting() {
  final hour = DateTime.now().hour;
  if (hour < 12) return 'dashboard.greeting.morning';
  if (hour < 17) return 'dashboard.greeting.afternoon';
  if (hour < 21) return 'dashboard.greeting.evening';
  return 'dashboard.greeting.night';
}

class _Content extends StatefulWidget {
  const _Content({
    required this.args,
    required this.todayDate,
    required this.targets,
    required this.isFirstRun,
  });

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
  /// The browsable days, oldest → today (future days aren't pageable). Today is
  /// always the last page; the strip centers today at index 3, so the past half
  /// (indices 0..3) is exactly today and the three days before it.
  late final List<String> _days = buildCenteredStripFromAnchor(
    widget.todayDate,
  ).days.sublist(0, 4);
  late final int _todayPage = _days.length - 1;

  // The day whose summary the Today card shows; tapping a strip day or swiping
  // the card changes it. Defaults to today (the last page).
  late int _page = _todayPage;
  late final PageController _pageController = PageController(
    initialPage: _todayPage,
  );

  String get _selectedDate => _days[_page];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  /// Strip tap → animate the day card to that page (selection haptic fires in
  /// the strip's own GestureDetector). Future / out-of-window days are ignored.
  void _onSelectDay(String date) {
    final idx = _days.indexOf(date);
    if (idx < 0 || idx == _page) return;
    _pageController.animateToPage(
      idx,
      duration: const Duration(milliseconds: 280),
      curve: const Cubic(0.16, 1, 0.3, 1),
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
    final bottomInset = MediaQuery.of(context).padding.bottom;
    final locale = context.locale.toString();

    return Stack(
      children: [
        ListView(
          padding: EdgeInsets.only(
            left: KalloSpacing.sp3,
            right: KalloSpacing.sp3,
            top: DashboardSpacing.block,
            // Clear the FAB's resting footprint (44 + 20 bottom) with a small
            // gap — no more than that, so the scroll doesn't end in dead space.
            bottom: bottomInset + 76,
          ),
          children: [
            // SECTION 1 — week strip + the paged day-viewer (greeting now lives
            // in the header row, beside the hamburger).
            WeekStrip(
              args: widget.args,
              todayDate: widget.todayDate,
              selectedDate: _selectedDate,
              onSelectDay: _onSelectDay,
            ),
            Padding(
              // The card owns no margin; this stack owns the gap under it.
              padding: const EdgeInsets.only(bottom: DashboardSpacing.block),
              child:
                  widget.isFirstRun
                      ? TodaySection(
                        args: widget.args,
                        targets: widget.targets,
                        dateLabel: _dateLabel(widget.todayDate, locale),
                        isFirstRun: true,
                      )
                      : DayPager(
                        controller: _pageController,
                        days: _days,
                        todayPage: _todayPage,
                        userId: widget.args.userId,
                        targets: widget.targets,
                        onPageChanged: _onPageChanged,
                        dateLabel: (d) => _dateLabel(d, locale),
                      ),
            ),
            // SECTION 2 — Progress.
            _Section(
              children: [
                SectionHeader(
                  title: tr('dashboard.progress'),
                  range: tr('dashboard.ranges.thirtyDays'),
                ),
                WeightChart(todayDate: widget.todayDate, args: widget.args),
              ],
            ),
            // SECTION 3 — Consistency. Last section: no trailing margin, so the
            // scroll ends right under the heatmap instead of a dead gap.
            _Section(
              last: true,
              children: [
                SectionHeader(
                  title: tr('dashboard.consistency'),
                  range: tr('dashboard.ranges.ninetyDays'),
                ),
                AdherenceHeatmap(args: widget.args),
              ],
            ),
          ],
        ),
        // Mobile-only FAB (web `md:hidden` FloatingMealTrigger).
        const FloatingMealTrigger(),
      ],
    );
  }
}

/// A dashboard section: header + card on the one [DashboardSpacing.block]
/// rhythm. Neither the header nor the card carries a margin — this stack owns
/// every gap; [last] drops the trailing one so the scroll ends under the card.
class _Section extends StatelessWidget {
  const _Section({required this.children, this.last = false});
  final List<Widget> children;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : DashboardSpacing.block),
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
